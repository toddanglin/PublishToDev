import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import * as fetch from "node-fetch";
import * as azure from "azure-storage";
import * as moment from "moment";
import * as df from "durable-functions"

const ts = azure.createTableService();
const tn = "schedules";

const httpStart: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const client = df.getClient(context);

    if (!validateParams(req.body, context)) {
        return;
    };

    // Save values to storage
    let item = {
        id: req.body.id,
        title: req.body.title,
        pubtime: req.body.pubtime,
        apikey: req.body.apikey,
        ispublished: false,
        PartitionKey: req.body.apikey,
        RowKey: req.body.id,
        instanceId: undefined,
        statusUrl: undefined,
        cancelUrl: undefined
    }

    // Use devto API to validate that provided API key has access to provided post ID (P2)
    let req_body = {
        title: item.title
    };
    // Have to do a PUT operation; Current DevTo API does not provide way to do GET on unpublished drafts
    // In the future, would be better to just do GET here; Hack is to reset title to original value
    let req_options = {
        method: 'PUT',
        headers: {
            'api-key': item.apikey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(req_body)
    };
    try {
        let url = `https://dev.to/api/articles/${ item.id }`
        let result = await fetch(url, req_options);
        let json = await result.json();

        if (result.status !== 200) {
            throw Error("Invalid post ID or insufficient permissions");
        }

        // No errors means the API key and post ID match and should work for scheduling
        // While were here, let's just make sure the post isn't already published
        if (json.published_at !== null) {
            context.log("Post is already published. Does not need scheduling.", json.published_at);
            context.res = {
                status: 400,
                body: `Well, this is awkward. The post with ID:${ item.id } already appears to be published. Please provide a different post ID and try again.`
            }
            return;
        }
    } catch (err) {
        context.log(`DevTo user API key does not have permission to update post with ID:${item.id}`, err);
        context.res = {
            status: 500,
            body: `Ruh roh. The provided DevTo user API key does not have permission to publish post with ID:${ item.id }. Please check the API key and post ID and try again.`
        }
        return;
    }

    // Query table storage first to validate there is not already a record for the provide post ID
    // If there IS an existing record, we need the durable instance ID to replace existing schedule
    try {
        const resp = await getEntity(ts, tn, item.PartitionKey, item.id);
        if (resp && resp.instanceId && resp.instanceId._ !== "") {
            context.log("Existing record with instance ID found", resp.instanceId._);
            item.instanceId = resp.instanceId._;
        } else {
            context.log("No existing record found", resp);
        }
    } catch (error) {
        context.res = {
            status: 500,
            body: "Darn. Something went wrong looking-up the item."
        }
    }

    // Start new durable function with post ID, publish time, apikey (and instanceId if exists)
    // Get back new instance ID of new durable function (that's handling the scheduled posting)
    
    let inputs = {
        id: item.id.toString(),
        apikey: item.apikey,
        pubtime: item.pubtime,
        instanceId: item.instanceId
    };
    try {
        // TODO: Probably a better way to kick this off using event hub and triggers (for future improvement)
        const instanceId = await client.startNew('schedulePostOrchestrator', item.instanceId, inputs);
        context.log(`Started orchestration with ID = '${instanceId}'.`);

        // Get instance ID from result and update item
        item.instanceId = instanceId;

        if (item.instanceId == undefined) {
            context.log("Welp. Orchestration didn't seem to work. Don't continue.");
            context.res = {
                status: 500,
                body: "Welp. Something went wrong scheduling this post."
            }
            return;
        }
    } catch (err) {
        context.log("Argh. Something went wrong starting orchestration.", err);
        context.res = {
            status: 500,
            body: "Oops. Something went wrong scheduling this post."
        }
        return;
    }

    // Save/update to storage details of post + instance ID for future status checks
    try {
        const result = await insertEntity(ts, tn, item);

        context.res = {
            body: `Post with ID:${item.id} is scheduled to publish on ${moment(parseInt(item.pubtime)).format('Do MMMM YYYY, h:mm A')} UTC`
        }
    } catch (err) {
        context.log("Something went wrong saving details in table storage", err);

        context.res = {
            status: 500,
            body: "Oops. Something went wrong saving the publishing details."
        }
    }
};

function validateParams(body, context) {
    let status, msg;
    if (!body) {
        status = 400;
        msg = "Please provide the required parameters in the request body";
        context.log("Missing POST body with required parameters")
    } else if (!(body.id && body.pubtime && body.apikey)) {
        status = 400;
        msg = "Required parameters missing. Please provide id, pubtime and apikey parameters."
        context.log("Missing required minimum parameters")
    } else if (moment(parseInt(body.pubtime)).isSameOrBefore(Date.now())) {
        status = 400;
        msg = "Publish time must be in the future. Please choose a new time and try again.";
        context.log("Invalid publish time. Publish time must be in the future.")
    }

    if (status && msg) {
        context.res = {
            status: status,
            body: msg
        }

        return false; //validation failed
    } else {
        return true;
    }
}

// Asyncifying Table Storage SDK (won't be necessary when v10 available)
async function insertEntity(tableService: azure.TableService, ...args) {
    return new Promise((resolve, reject) => {
        let promiseHandling = (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        };
        args.push(promiseHandling);
        tableService.insertOrReplaceEntity.apply(tableService, args);
    });
};

// Asyncifying Table Storage SDK (won't be necessary when v10 available)
async function getEntity(tableService:azure.TableService, ...args): Promise<any> {
    return new Promise((resolve, reject) => {
        let promiseHandling = (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        };
        args.push(promiseHandling);
        tableService.retrieveEntity.apply(tableService, args);
    });
};

export default httpStart;

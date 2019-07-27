import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import * as azure from "azure-storage";
import * as df from "durable-functions"

const ts = azure.createTableService();
const tn = "schedules";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    if (!validateParams(req.body, context)) {
        return;
    }

    const client = df.getClient(context);
    const item = req.body;

    try {
        let result = await client.terminate(item.instanceId, "User cancelled");   
        
        // It seems an "undefined" result is associated with terminate success, so...no way to check synchronously...
        // Just assume it worked if now exception thrown for now...
        let actionResult = await client.waitForCompletionOrCreateCheckStatusResponse(req, item.instanceId, 10000, 1000);
        if (actionResult.body) {
            let status = JSON.parse(<any>actionResult.body).runtimeStatus;
            if (!(status == "Terminated")) {
                throw Error(`Failed to verify scheduled post is terminated. Reported status: ${ status }`);
            }
        }
    } catch (error) {
        context.log(`Nerp. Failed to cancel orchestration with instanceId: ${ item.instanceId }`, error);
        context.res = {
            status: 500,
            body: `Something went wrong trying to cancel the schedule for post with ID: ${ item.id }. Please try again.`
        }
        return;
    }

    const updatedEntity = {
        iscancelled: true,
        PartitionKey: item.apikey,
        RowKey: item.id
    }
    // Save/update to storage details of post + instance ID for future status checks
    try {
        const result = await mergeUpdateEntity(ts, tn, updatedEntity);
        context.log("Item publish status updated");
        context.res = {
            status: 200,
            body: `Schedule for post with ID: ${ item.id } successfully cancelled`
        }
    } catch (err) {
        console.log("Something went wrong updating publish status in table storage", err);
        context.res = {
            status: 500,
            body: `Schedule has been cancelled, but there was error updating the database.`
        }
    }
};

// Asyncifying Table Storage SDK (won't be necessary when v10 available)
async function mergeUpdateEntity(tableService: azure.TableService, ...args) {
    return new Promise((resolve, reject) => {
        let promiseHandling = (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        };
        args.push(promiseHandling);
        tableService.mergeEntity.apply(tableService, args);
    });
};

function validateParams(body, context) {
    let status, msg;
    if (!body) {
        status = 400;
        msg = "Please provide the required parameters in the request body";
        context.log("Missing POST body with required parameters")
    } else if (!(body.apikey && body.instanceId && body.id)) {
        status = 400;
        msg = "Required parameters missing. Please provide apikey, id and instanceId parameters."
        context.log("Missing required minimum parameters")
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

export default httpTrigger;

import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import * as azure from "azure-storage";
import { isContext } from "vm";

const ts = azure.createTableService();
const tn = "schedules";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    if (!validateParams(req.body, context)) {
        return;
    }
    
    const apikey = req.body.apikey;
    const query = new azure.TableQuery()
        .top(50)
        .where('PartitionKey eq ?', apikey);

    // Attempt to get all user schedules from storage and return
    try {
        const result = await queryTable(ts,tn,query, null, { payloadFormat: "application/json;odata=nometadata" });

        const payload = {
            results: result.value,
            token: result.continuationToken
        }

        context.res = {
            status: 200,
            body: JSON.stringify(payload)
        }
    } catch (err) {
        context.log("Oof. Something went wrong querying table.", err);
        context.res = {
            status: 500,
            body: "Sorry. Something went wrong trying to query the table for saved schedules."
        }
    }
};

// Asyncifying Table Storage SDK (won't be necessary when v10 available)
async function queryTable(tableService:azure.TableService, ...args): Promise<any> {
    return new Promise((resolve, reject) => {
        let promiseHandling = (err, result, response) => {
            if (err) {
                reject(err);
            } else {
                // response.body provides payload with specific payloadFormat
                // result does not respect payloadFormat
                resolve(response.body);
            }
        };
        args.push(promiseHandling);
        tableService.queryEntities.apply(tableService, args);
    });
};

function validateParams(body, context) {
    let status, msg;
    if (!body) {
        status = 400;
        msg = "Please provide the required parameters in the request body";
        context.log("Missing POST body with required parameters")
    } else if (!(body.apikey)) {
        status = 400;
        msg = "Required parameters missing. Please provide apikey parameter."
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

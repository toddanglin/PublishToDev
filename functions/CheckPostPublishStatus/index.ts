import { AzureFunction, Context } from "@azure/functions"
import * as azure from "azure-storage";

const ts = azure.createTableService();
const tn = "schedules";

const activityFunction: AzureFunction = async function (context: Context): Promise<boolean> {
    const item = context.bindings.post;

    // Query table storage first to validate the post has not been published
    try {
        const post = await getEntity(ts, tn, item.apikey, item.id, { payloadFormat: 'application/json;odata=nometadata' });
        if (post) {
            context.log("Existing record found", post);

            if (post.ispublished == true || post.iscancelled == true) {
                return true;
            } else {
                return false;
            }
        } else {
            context.log("No existing record found", post);
            return false;
        }
    } catch (error) {
        context.res = {
            status: 500,
            body: "Darn. Something went wrong looking-up the item."
        }
    }
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


export default activityFunction;

import * as azure from "azure-storage";

const ts = azure.createTableService();
const tn = "schedules";

import { AzureFunction, Context } from "@azure/functions"

const activityFunction: AzureFunction = async function (context: Context): Promise<void> {
    const item = context.bindings.post;
    const updatedEntity = {
        ispublished: item.ispublished,
        PartitionKey: item.apikey.toString(),
        RowKey: item.id.toString(),
        url: item.url
    }

    context.log("UpdatePublishStatus with these values", item.ispublished, item.url);

    // Save/update to storage details of post + instance ID for future status checks
    try {
        const result = await mergeUpdateEntity(ts, tn, updatedEntity);
        context.log("Item publish status updated");
    } catch (err) {
        console.log("Something went wrong updating publish status in table storage", err);
        throw err;
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

export default activityFunction;

import { AzureFunction, Context } from "@azure/functions"
import * as fetch from "node-fetch";

const activityFunction: AzureFunction = async function (context: Context): Promise<string> {
    const item = context.bindings.post;

    // REST call to DevTo API to update post (requires post ID + User API Key)

    // USED FOR TESTING -- Only updates the post title at scheduled publish time
    // TODO: Provide dynamic option to trigger test mode for future testing/dev
    /*let request_body = {
        title: `TEST Update ${Date.now()}`
    };*/

    // USED FOR PROD -- Sets published status to true at scheduled publish time
    let request_body = {
        published: true
    };

    let request_options = {
        method: 'PUT',
        headers: {
            'api-key': item.apikey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(request_body)
    };
    try {
        const url = `https://dev.to/api/articles/${item.id}`;
        const result = await fetch(url, request_options);
        const json = await result.json();

        context.log("DevTo article updated", json);

        const postUrl = json.url;
        return postUrl; // Absolute URL to public post on dev.to
    } catch (err) {
        context.log("Argh. Something went wrong updating the article on DevTo.", err);
        
        throw err;
    }
};

export default activityFunction;

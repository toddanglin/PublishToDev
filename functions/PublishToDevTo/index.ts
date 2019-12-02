import { AzureFunction, Context } from "@azure/functions"
import * as fetch from "node-fetch";

const activityFunction: AzureFunction = async function (context: Context): Promise<string> {
    const item = context.bindings.post;
    let request_body;

    // REST call to DevTo API to update post (requires post ID + User API Key)

    // USED FOR TESTING -- Only updates the post title at scheduled publish time
    // TODO: Provide dynamic option to trigger test mode for future testing/dev
    /*let request_body = {
        title: `TEST Update ${Date.now()}`
    };*/


    // USED FOR PROD -- Sets published status to true at scheduled publish time
    request_body = {
        published: true
    };

    // Try to update the article and publish using JSON 'published' property
    // NOTE: This will fail if article has been created with 'v1' DevTo editor and contains front matter
    let post = await updateDevToArticle(item.apikey, item.id, request_body, context);

    // Handle markdown posts with front matter created with v1 editor
    if (post.published_at === null && post.body_markdown && post.body_markdown.startsWith('---')) {
        context.log('Post created with v1 editor. Attempting to publish with markdown update.');

        if (post.body_markdown.indexOf('published: false') > 0) {
            // Using simple string replacement because YAML parsing errors caused issues
            // (DevTo allows ':' in description and title, which busts YAML parsing with libs like gray-matter)
            post.body_markdown = post.body_markdown.replace('published: false', 'published: true');

            context.log('Updated Post Markdown', post.body_markdown);

            request_body = {
                body_markdown: post.body_markdown
            }
    
            post = await updateDevToArticle(item.apikey, item.id, request_body, context);
        } else {
            const err = 'Body markdown did not have expected "publish: false" attribute.';
            context.log(err, post.body_markdown);
            throw new Error(err);
        }
    }

    if (post.published_at === null) {
        // Despite our best efforts, publishing has failed :(
        context.log(`Publishing Failed for post with ID ${item.id}`);
        return undefined;
    } else {
        context.log(`Article with ID: ${ item.id } published at ${ post.published_at }`);
        return post.url; // Absolute URL to public post on dev.to
    }
};

async function updateDevToArticle(apikey, id, body, context): Promise<any> {
    let request_options = {
        method: 'PUT',
        headers: {
            'api-key': apikey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
    try {
        const url = `https://dev.to/api/articles/${id}`;
        const result = await fetch(url, request_options);
        const json = await result.json();

        context.log("DevTo article updated", json);

        return json;
    } catch (err) {
        context.log("Argh. Something went wrong updating the article on DevTo.", err);

        // TODO: Automatic retry if failure is related to network?

        throw (err);
    }
}

export default activityFunction;

import { AzureFunction, Context } from "@azure/functions"
import * as fetch from "node-fetch";
import * as matter from "gray-matter";

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

        // To publish posts with font matter, must update the body_markdown
        let updatePost = matter(post.body_markdown);
        updatePost.data.published = true;
        
        // USED FOR TESTING -- Only updates the post title
        //updatePost.data.title = `${updatePost.data.title} ${Date.now()}`;

        context.log('Updated Post Markdown', updatePost.stringify(''));

        request_body = {
            body_markdown: updatePost.stringify('')
        }

        post = await updateDevToArticle(item.apikey, item.id, request_body, context);
    }

    context.log(`Article with ID: ${ item.id } published at ${ post.published_at }`);

    const postUrl = post.url;
    return postUrl; // Absolute URL to public post on dev.to
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

        throw (err);
    }
}

export default activityFunction;

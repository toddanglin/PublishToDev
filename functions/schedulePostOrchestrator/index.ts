import * as df from "durable-functions"
import * as moment from "moment";

const orchestrator = df.orchestrator(function* (context) {
    const outputs = [];
    const input = <any>context.df.getInput();

    //Orchestrate the future publishing of a blog post
    const pubTime = moment.utc(parseInt(input.pubtime));
    const now = moment.utc(context.df.currentUtcDateTime);

    while (now.isBefore(pubTime)) {
        const maxTimer = now.add(7, 'days'); // Current limit for DF timer
        if (pubTime.isAfter(maxTimer)) {
            // Create timer to wait max and then try again      
            context.log("Publish time is more than 7 days in future. Sleeping for max timer.");      
            yield context.df.createTimer(maxTimer.toDate()); // TODO: Handle cancellation tokens?
        } else {
            // Within 7 days of publish time; Set exact timer to publish
            context.log(`Publish time is within 7 days. Setting exact timer to ${pubTime.format('MMMM Do YYYY, h:mm a')}`);
            yield context.df.createTimer(pubTime.toDate());
        }
    }

    // Publish time (pubtime is in the past)
    // TODO: Activity to check table storage and validate still not published
    let isPublished = yield context.df.callActivity("CheckPostPublishStatus", input);

    // Activity to publish post to dev.to
    if (!isPublished) {
        try {
            let url = yield context.df.callActivity("PublishToDevTo", input);

            if (url === undefined) {
                context.log(`Post with ID:${input.id} FAILED to publish.`);
                input.isfailed = true;

                // TODO: Send notification to author?
            } else {
                context.log(`Post with ID:${input.id} has been published to DevTo!`);   

                // Add the public post URL to the post details (will get saved to storage in next step)
                input.url = url;
                input.ispublished = true;
            }

            // Update table storage (isPublished)
            yield context.df.callActivity("UpdatePublishStatus", input);
        } catch (error) {
            context.log("Something went wrong publishing to DevTo", error);

            // TODO: Decide how to inform user that scheduled publish failed
        }
    } else {
        context.log(`Post status is already published or cancelled. Will not attempt to publish post with ID: ${ input.id }.`)
    }

    // TODO: (Optional) Activity to send notification to author about post publish (need author email)


    context.log(`The post has been published. Publish monitor expiring.`);
});

export default orchestrator;

# Bossett's little feed collection

This code was originally a fork of https://github.com/bluesky-social/feed-generator - and you can look there for more information about the mechanics of feed generation. In particular - for questions about 'how to publish the feed' from the script in the scripts folder.

## Science Feed

Watches for 🧪 posted by people on a set of watchlists (e.g. https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/lists/3jx3w32axax2f)

Feed at https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/feed/for-science

## #auspol Feed

Watches for case-insensitive 'auspol', putes them in the feed and adds those posters to a list (e.g. https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/lists/3jzy2aybxwz2f).

Intended to aid discovery of new auspol posters, as well as provide the feed function.

Feed at https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/feed/auspol

## Usage

I run this with Digital Ocean App Platform, with their MongoDB as an attached service.

### Database

You probably don't need Mongo if you're just doing something simple - and I've put all the DB work in [src/db/dbClient.ts](src/db/dbClient.ts) to make that easy to change.

### Docker

I am deploying with Docker rather than the default Node containers. This was more important early on for control over the exact Node version, as certain dependencies were linked tightly to Node 18.

## Adding Feeds

The tool is built to have each algorithm self-contained within a file in [src/algos](src/algos). Each algorithm should export both a handler function and manager class (that can inherit from algoManager - see the for-science feed). The _manager_ is expected to implement a filter method that will match posts that the algorithm will later deal with.

Where there's a match, the post will be stored in the database, tagged for the algorithm that matched. This can be used later in the handler function to identify posts that the algorithm should return.

Feeds will have periodicTask called every X minutes from the environment setting in FEEDGEN_TASK_INTEVAL_MINS - this is for things like list updates, or time consuming tasks that shouldn't happen interactively.

## Major TODOs

- TODO: Rename environment variables, etc. to make settings more generic
- TODO: Cache header in feed-generation.ts
- TODO: List for exclusion, header catching
- TODO: Pin function

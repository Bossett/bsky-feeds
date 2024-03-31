# @adrian.uy's feed collection

Forked from  [Bossett's little feed collection](https://github.com/Bossett/bsky-feeds)

This code was originally a fork of https://github.com/bluesky-social/feed-generator - and you can look there for more information about the mechanics of feed generation. In particular - for questions about 'how to publish the feed' from the script in the scripts folder.

# Hosting

Bossett's guide that tracks how I host the tool - you can find it at https://bossett.io/setting-up-bossetts-bluesky-feed-generator/. It walks you through setup of the app on [Digital Ocean](https://m.do.co/c/a838c8f1e33a).

# Feeds

## Uruguay Feed

Feed at https://bsky.app/profile/did:plc:jupasj2qzpxnulq2xa7evmmh/feed/uruguay

## #Argentina Feed

Feed at https://bsky.app/profile/did:plc:jupasj2qzpxnulq2xa7evmmh/feed/argentina

## Rio de la Plata

Feed at https://bsky.app/profile/did:plc:jupasj2qzpxnulq2xa7evmmh/feed/riodelaplata

## Fediverse

Feed at https://bsky.app/profile/did:plc:jupasj2qzpxnulq2xa7evmmh/feed/fediverse

## Salesforce

Feed at https://bsky.app/profile/did:plc:jupasj2qzpxnulq2xa7evmmh/feed/salesforce


# From Bossett's README

# Usage

I run this with Digital Ocean App Platform, with their MongoDB as an attached service.

## Database

You probably don't need Mongo if you're just doing something simple - and I've put all the DB work in [src/db/dbClient.ts](src/db/dbClient.ts) to make that easy to change.

## Docker

I am deploying with Docker rather than the default Node containers. This was more important early on for control over the exact Node version, as certain dependencies were linked tightly to Node 18.

## Adding Feeds

The tool is built to have each algorithm self-contained within a file in [src/algos](src/algos). Each algorithm should export both a handler function and manager class (that can inherit from algoManager - see the for-science feed). The _manager_ is expected to implement filter methods (e.g. filter_post) that will match events that the algorithm will later deal with.

Where there's a match, the post will be stored in the database, tagged for the algorithm that matched. This can be used later in the handler function to identify posts that the algorithm should return.

Feeds will have periodicTask called every X minutes from the environment setting in FEEDGEN_TASK_INTEVAL_MINS - this is for things like list updates, or time consuming tasks that shouldn't happen interactively.

## Migration to SQLite
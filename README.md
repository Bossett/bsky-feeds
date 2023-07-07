# Bossett's little feed collection

Playing around with Bluesky's custom feeds. Very basic - just a small iteration on the template for the moment, to grab a user list, and then look for specific terms in posts from those users.

## Science Feed

Watches for 🧪 posted by people on a set of watchlists (e.g. https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/lists/3jx3w32axax2f)

Feed at https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/feed/for-science

## Major TODOs

TODO: Cache header in feed-generation.ts
TODO: List for exclusion, header catching
TODO: Migrate UpdateFeed logic into for-science.ts
TODO: Move db logic into single location
TODO: Pin function
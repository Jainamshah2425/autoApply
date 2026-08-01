/**
 * Seed the System Design case-study bank when it's empty (uses backend/.env MONGODB_URI).
 * Usage: node scripts/seedSystemDesignQuestions.js
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const SystemDesignQuestion = require('../models/SystemDesignQuestion');

const QUESTIONS = [
  {
    title: 'Design a Rate Limiter',
    slug: 'rate-limiter',
    difficulty: 'easy',
    prompt: 'Design a rate limiter that throttles requests to an API based on a configurable limit (e.g. 10 requests per user per second), used either as client-side middleware or as a standalone gateway service in front of a set of backend services.',
    functionalRequirements: [
      'Accurately limit excessive requests per client (by user ID, IP, or API key)',
      'Return a clear signal (e.g. HTTP 429) when a client is throttled',
      'Support configurable rules per API/route/tier',
    ],
    nonFunctionalRequirements: [
      'Low added latency to every request',
      'Use as little memory as possible while staying accurate',
      'Must work correctly across multiple servers behind a load balancer',
    ],
    keyTopics: ['rate limiting algorithms', 'token bucket', 'sliding window', 'redis', 'distributed systems'],
    referenceApproach: [
      'Compare algorithms: token bucket, leaky bucket, fixed window counter, sliding window log, sliding window counter — discuss memory vs accuracy trade-offs.',
      'Recommend sliding window counter or token bucket for most APIs: good accuracy, bounded memory.',
      'Store counters in a shared store (Redis) instead of in-process memory so limits are consistent across multiple gateway instances.',
      'Use Redis INCR + EXPIRE or a Lua script for atomic check-and-increment to avoid race conditions.',
      'Place the limiter at the edge (API gateway) rather than in each service to keep rules centralized.',
      'Return 429 with a Retry-After header; expose current limit/remaining/reset via response headers.',
      'Consider a "soft" in-memory fallback if Redis is briefly unavailable (fail open vs fail closed trade-off).',
    ],
    estimatedMinutes: 30,
  },
  {
    title: 'Design Consistent Hashing',
    slug: 'consistent-hashing',
    difficulty: 'easy',
    prompt: 'Design a consistent hashing scheme to distribute keys (or requests) across a dynamic set of servers/caches such that adding or removing a node only reshuffles a small fraction of keys.',
    functionalRequirements: [
      'Map keys to servers such that lookups are fast and deterministic',
      'When a server is added or removed, only that server\'s share of keys should move',
      'Distribute keys roughly evenly across servers',
    ],
    nonFunctionalRequirements: [
      'O(log N) or better lookup for which server owns a key',
      'Handle uneven load caused by hot keys or too few nodes',
    ],
    keyTopics: ['consistent hashing', 'hash ring', 'virtual nodes', 'load distribution'],
    referenceApproach: [
      'Explain the problem with naive `hash(key) % N` hashing: adding/removing a server remaps almost all keys.',
      'Introduce the hash ring: hash both servers and keys onto the same circular space; a key belongs to the first server clockwise from it.',
      'Removing/adding one server only affects the keys between it and its neighbor on the ring — a small, bounded fraction.',
      'Address uneven distribution with virtual nodes: each physical server maps to many points on the ring, smoothing out load.',
      'Discuss picking a good number of virtual nodes (trade-off between balance and metadata size).',
      'Mention real-world uses: DynamoDB, Cassandra partitioning, CDN/cache sharding (e.g. memcached client-side hashing).',
    ],
    estimatedMinutes: 30,
  },
  {
    title: 'Design a Key-Value Store',
    slug: 'key-value-store',
    difficulty: 'hard',
    prompt: 'Design a distributed key-value store (like DynamoDB or Cassandra) that supports simple get(key)/put(key, value) operations at large scale with high availability.',
    functionalRequirements: [
      'put(key, value) and get(key) with low latency',
      'Data replicated across multiple nodes for durability',
      'Tunable consistency (e.g. eventual vs strong)',
    ],
    nonFunctionalRequirements: [
      'High availability — remain writable/readable during node failures',
      'Horizontally scalable to very large data sets',
      'Partition tolerant (CAP trade-offs must be explicit)',
    ],
    keyTopics: ['CAP theorem', 'consistent hashing', 'replication', 'quorum', 'vector clocks', 'gossip protocol'],
    referenceApproach: [
      'Start with CAP: for a highly available store, favor AP and pick eventual consistency with tunable read/write quorums.',
      'Use consistent hashing with virtual nodes to partition keys across the cluster.',
      'Replicate each key to N nodes (the key\'s successors on the ring); use quorum reads/writes (R + W > N) to balance consistency and availability.',
      'Handle conflicting concurrent writes with vector clocks or last-write-wins, and resolve on read (read-repair) or via application logic.',
      'Use gossip protocol for failure detection and cluster membership instead of a single coordinator.',
      'Add a write-ahead log / SSTables (LSM-tree) per node for durable, fast writes, plus background compaction.',
      'Use Merkle trees for anti-entropy — efficiently syncing replicas that fell behind.',
    ],
    estimatedMinutes: 50,
  },
  {
    title: 'Design a Unique ID Generator in Distributed Systems',
    slug: 'unique-id-generator',
    difficulty: 'medium',
    prompt: 'Design a service that generates unique, roughly time-sortable 64-bit IDs across many machines without coordination on every request (similar to Twitter Snowflake).',
    functionalRequirements: [
      'IDs must be unique across the whole distributed system',
      'IDs should be sortable by generation time (roughly increasing)',
      'Fit in 64 bits for compact storage/indexing',
    ],
    nonFunctionalRequirements: [
      'Very high throughput per node, no synchronous cross-node coordination per ID',
      'Available even if some nodes are down',
    ],
    keyTopics: ['snowflake', 'distributed id generation', 'clock synchronization', 'sharding'],
    referenceApproach: [
      'Rule out auto-increment DB IDs (single point of contention) and pure UUIDs (not sortable, 128-bit).',
      'Adopt a Snowflake-style layout: sign bit + timestamp (ms since epoch) + datacenter ID + machine ID + per-ms sequence number, packed into 64 bits.',
      'Each machine generates IDs independently using its local clock and machine ID — no cross-node calls needed per ID.',
      'Handle clock drift/NTP adjustments: detect backward clock jumps and either wait or reject generation until caught up.',
      'Discuss bit-width trade-offs: more sequence bits = higher per-ms throughput per node, fewer machine-ID bits = fewer supportable nodes.',
      'Mention machine/datacenter ID assignment via config or a coordination service (e.g. Zookeeper) at startup, not per-request.',
    ],
    estimatedMinutes: 30,
  },
  {
    title: 'Design a URL Shortener',
    slug: 'url-shortener',
    difficulty: 'easy',
    prompt: 'Design a service like bit.ly that converts a long URL into a short alias and redirects users from the short URL to the original one.',
    functionalRequirements: [
      'Given a long URL, generate a unique short URL',
      'Given a short URL, redirect to the original long URL',
      'Optionally support custom aliases and expiration',
    ],
    nonFunctionalRequirements: [
      'Redirects must be very low latency',
      'System should be highly available (redirects are the critical path)',
      'Read-heavy workload (far more redirects than creations)',
    ],
    keyTopics: ['base62 encoding', 'hashing', 'caching', 'database sharding'],
    referenceApproach: [
      'Estimate scale first: writes/sec, reads/sec (read:write ratio often 100:1+), storage over N years.',
      'Generate short codes either via base62-encoding an auto-incrementing/pre-allocated ID range per server, or by hashing the URL and taking the first 7 chars (checking for collisions).',
      'Store mapping in a simple key-value table (shortCode -> longURL, createdAt, expiresAt); this is a natural fit for a KV store or a sharded relational table.',
      'Put a cache (e.g. Redis) in front of the DB for hot short codes since reads dominate.',
      'On redirect: cache lookup -> DB lookup -> 301/302 redirect; use 301 cautiously (browsers cache it, bypassing your analytics).',
      'Shard the datastore by short code hash once a single DB can\'t hold the data/throughput.',
      'Add rate limiting on the create endpoint to prevent abuse.',
    ],
    estimatedMinutes: 30,
  },
  {
    title: 'Design a Web Crawler',
    slug: 'web-crawler',
    difficulty: 'medium',
    prompt: 'Design a scalable web crawler that starts from a set of seed URLs, downloads pages, extracts new links, and continues crawling the web while respecting site policies.',
    functionalRequirements: [
      'Given seed URLs, discover and download reachable pages',
      'Extract and enqueue new links found on each page',
      'Respect robots.txt and avoid re-crawling the same URL repeatedly',
    ],
    nonFunctionalRequirements: [
      'Scalable to billions of pages, extensible to new content types',
      'Polite: don\'t overload any single host',
      'Robust to malicious pages, crawler traps, and duplicate content',
    ],
    keyTopics: ['BFS crawling', 'URL frontier', 'politeness', 'deduplication', 'bloom filter'],
    referenceApproach: [
      'High-level pipeline: URL frontier -> HTML downloader -> DNS resolver -> content parser -> dedup checks -> content storage -> new-URL extractor -> back to frontier.',
      'Use BFS from seed URLs (not DFS) to avoid getting stuck deep in one site; model the web as a graph.',
      'URL frontier splits into a priority queue (crawl priority/freshness) and per-host queues with delays to enforce politeness (don\'t hammer one server).',
      'Deduplicate URLs using a hash set or Bloom filter to avoid re-crawling; deduplicate content via document fingerprint/checksum to skip near-duplicate pages.',
      'Respect robots.txt per host and cache it; set a descriptive User-Agent and crawl-delay.',
      'Handle crawler traps (infinite dynamically-generated links) with max depth/length limits and anomaly detection.',
      'Make each stage horizontally scalable and independently deployable (queue-based, stateless workers).',
    ],
    estimatedMinutes: 45,
  },
  {
    title: 'Design a Notification System',
    slug: 'notification-system',
    difficulty: 'medium',
    prompt: 'Design a system that sends notifications to users across push, SMS, and email, triggered by internal services (e.g. "order shipped", "new comment").',
    functionalRequirements: [
      'Support push notifications (iOS/Android), SMS, and email',
      'Internal services can trigger notifications via a simple API/event',
      'Support user notification preferences and unsubscribe',
    ],
    nonFunctionalRequirements: [
      'High throughput with minimal latency for time-sensitive alerts',
      'Reliable delivery — no lost notifications; avoid duplicate sends',
      'Extensible to new channels without touching calling services',
    ],
    keyTopics: ['message queue', 'push notification (APNs/FCM)', 'retry with backoff', 'idempotency'],
    referenceApproach: [
      'Decouple "decide to notify" from "actually send" using a message queue between notification-triggering services and per-channel workers.',
      'Provide one unified notification API/event that fans out to per-channel queues (push, SMS, email) based on user preferences.',
      'Each channel has its own worker pool calling the relevant third-party gateway (APNs/FCM for push, Twilio for SMS, an ESP for email).',
      'Make sends idempotent (dedupe key per notification) so consumer retries after a crash don\'t double-send.',
      'Retry failed sends with exponential backoff and a dead-letter queue for permanently failed messages.',
      'Store notification templates and user preference/opt-out settings centrally so channels stay consistent.',
      'Add monitoring for queue depth and third-party provider error rates to catch delivery degradation quickly.',
    ],
    estimatedMinutes: 40,
  },
  {
    title: 'Design a News Feed System',
    slug: 'news-feed-system',
    difficulty: 'hard',
    prompt: 'Design a social media news feed (like Facebook/Instagram/Twitter) that shows a user posts from the people/pages they follow, ranked and reasonably fresh.',
    functionalRequirements: [
      'Users can publish posts',
      'Users can view a feed aggregating posts from everyone they follow',
      'Feed should reflect new posts within a reasonable delay',
    ],
    nonFunctionalRequirements: [
      'Feed reads must be fast even for users following thousands of people',
      'Scale to a very large, highly connected social graph (celebrities with millions of followers)',
      'Eventually consistent is acceptable; strict real-time isn\'t required',
    ],
    keyTopics: ['fan-out on write', 'fan-out on read', 'feed ranking', 'caching', 'hybrid approach'],
    referenceApproach: [
      'Split the system into a publishing (write) path and a feed-retrieval (read) path.',
      'Fan-out on write: when a user posts, push the post into each follower\'s precomputed feed cache — fast reads, but expensive for users with millions of followers ("celebrity problem").',
      'Fan-out on read: build the feed at request time by merging recent posts from everyone the user follows — avoids the celebrity problem but is slower per read.',
      'Recommend a hybrid: fan-out on write for normal users, fan-out on read (merge at request time) for celebrity/high-follower accounts.',
      'Cache precomputed feeds (post IDs, not full content) in a fast store like Redis; hydrate post content from a separate content store/CDN.',
      'Rank feed items by a scoring function (recency, engagement, affinity) rather than pure reverse-chronological order once basic fan-out works.',
      'Use message queues between the publishing service and fan-out workers so a single post doesn\'t block on writing to millions of feed caches.',
    ],
    estimatedMinutes: 50,
  },
  {
    title: 'Design a Chat System',
    slug: 'chat-system',
    difficulty: 'hard',
    prompt: 'Design a one-on-one and group chat system (like WhatsApp/Messenger) supporting real-time message delivery and read receipts.',
    functionalRequirements: [
      'Send/receive messages in 1:1 and small group chats with low latency',
      'Show online/offline presence and delivery/read receipts',
      'Persist chat history so users can retrieve it on a new device',
    ],
    nonFunctionalRequirements: [
      'Real-time delivery when both users are online',
      'Reliable delivery even if the recipient is offline (store-and-forward)',
      'Scalable to millions of concurrent connections',
    ],
    keyTopics: ['websockets', 'long polling', 'message queue', 'presence', 'sequence IDs'],
    referenceApproach: [
      'Use persistent WebSocket connections (with long polling as a fallback) between clients and stateless chat servers for real-time delivery.',
      'Maintain a connection-routing layer (e.g. in Redis) mapping userId -> which chat server instance holds their live connection, since a sender\'s server may differ from the recipient\'s.',
      'For offline recipients, persist the message in per-user message storage and push it on next connect (store-and-forward), plus trigger a mobile push notification.',
      'Assign a monotonically increasing per-conversation sequence ID to messages so clients can order them and detect gaps/dedupe on reconnect.',
      'Use a lightweight KV or wide-column store (not a relational join-heavy schema) for message history, partitioned by conversation ID.',
      'Track presence (online/last-seen) with heartbeats and a short TTL in a fast store; broadcast presence changes only to relevant contacts, not globally.',
      'For group chats, fan out a sent message to all online members\' connections and store it for offline members, same as 1:1 but with a small fan-out multiplier.',
    ],
    estimatedMinutes: 50,
  },
  {
    title: 'Design a Search Autocomplete System',
    slug: 'search-autocomplete',
    difficulty: 'medium',
    prompt: 'Design a typeahead/autocomplete system that suggests the top-k most likely search queries as a user types, similar to Google Search suggestions.',
    functionalRequirements: [
      'Return the top-k matching suggestions for a given prefix, ranked by popularity',
      'Update over time as query popularity shifts',
      'Low latency per keystroke',
    ],
    nonFunctionalRequirements: [
      'Suggestions should feel instant (well under 100ms end-to-end)',
      'Handle a very large and growing query volume/log',
      'Freshness can lag slightly behind real-time (near-real-time is fine)',
    ],
    keyTopics: ['trie', 'top-k ranking', 'precomputation', 'caching', 'sharding'],
    referenceApproach: [
      'Split into an offline pipeline (aggregate query logs, compute frequencies) and an online service (serve suggestions for a prefix fast).',
      'Use a trie keyed by characters; at each trie node, precompute/cache the top-k most frequent completed queries in that subtree so lookups are O(prefix length), not a subtree scan.',
      'Rebuild/update the trie periodically (e.g. hourly/daily) from aggregated query-frequency logs rather than updating it synchronously on every search — keeps writes cheap.',
      'Shard the trie by prefix range (e.g. first character) if it\'s too large for one node, with a routing layer directing requests to the right shard.',
      'Cache hot prefixes (e.g. single-letter and common two-letter prefixes) at an edge/CDN or in-memory cache since a small number of prefixes get most traffic.',
      'For personalization/freshness, optionally blend in a small real-time signal (e.g. trending queries in the last hour) on top of the precomputed top-k.',
    ],
    estimatedMinutes: 40,
  },
  {
    title: 'Design YouTube',
    slug: 'design-youtube',
    difficulty: 'hard',
    prompt: 'Design a video-sharing platform like YouTube: users upload videos, the platform transcodes them for various devices/bandwidths, and viewers stream them globally with low buffering.',
    functionalRequirements: [
      'Users can upload videos of varying formats/resolutions',
      'Videos are available for streaming shortly after upload, at multiple quality levels',
      'Viewers get smooth playback with adaptive quality based on their connection',
    ],
    nonFunctionalRequirements: [
      'Massive read (view) traffic vastly exceeds write (upload) traffic',
      'Global low-latency playback start and minimal rebuffering',
      'Durable storage for a huge, ever-growing volume of video data',
    ],
    keyTopics: ['video transcoding', 'CDN', 'adaptive bitrate streaming', 'object storage', 'metadata DB'],
    referenceApproach: [
      'Separate the upload/processing pipeline from the playback path — very different load and latency characteristics.',
      'Upload flow: client uploads raw video to a staging store, which triggers a transcoding pipeline (parallelized by splitting into chunks) producing multiple resolutions/bitrates and formats.',
      'Store transcoded video segments in object storage (e.g. S3-like blob store); store video metadata (title, owner, duration, available renditions) in a separate relational/document DB.',
      'Distribute video segments through a CDN so playback is served from an edge location near the viewer instead of the origin.',
      'Use adaptive bitrate streaming (e.g. DASH/HLS): video is chunked into short segments at multiple qualities, and the client player switches quality per-chunk based on measured bandwidth.',
      'Cache popular/trending videos more aggressively at the CDN edge; use safe upload retry (resumable uploads) for large files.',
      'Scale metadata reads (views, likes, comments count) with caching and eventual consistency — exact real-time counts aren\'t critical.',
    ],
    estimatedMinutes: 55,
  },
  {
    title: 'Design Google Drive',
    slug: 'design-google-drive',
    difficulty: 'hard',
    prompt: 'Design a cloud file storage and sync service like Google Drive/Dropbox: users upload files/folders, access them from multiple devices, and changes sync automatically across devices.',
    functionalRequirements: [
      'Upload, download, and organize files/folders',
      'Automatically sync changes across a user\'s devices',
      'Support sharing files/folders with other users and basic versioning',
    ],
    nonFunctionalRequirements: [
      'High availability and durability — files must not be lost',
      'Efficient sync — avoid re-uploading/downloading unchanged data',
      'Support very large files and large numbers of files per user',
    ],
    keyTopics: ['block-level sync', 'object storage', 'metadata DB', 'notification/sync service', 'conflict resolution'],
    referenceApproach: [
      'Split files into fixed-size blocks; on change, only re-upload/download the blocks that actually changed (delta sync) rather than the whole file.',
      'Store block data in object storage, deduplicated by content hash (identical blocks across files/users are stored once).',
      'Keep a separate metadata service/DB tracking file/folder structure, versions, block lists per file, and permissions — this is the source of truth clients sync against.',
      'Add a notification service (e.g. long-lived connection or long polling) that tells other online devices "something changed" so they can pull the metadata delta and fetch new blocks.',
      'Use local caching on each client plus a local DB of block hashes so unaffected files require no network calls at all.',
      'Handle offline edits and conflicts with a simple strategy (e.g. keep both versions / last-writer-wins with conflict copy) rather than trying full real-time merge.',
      'Chunk large uploads/downloads with resumable transfer and integrity checks (checksums) per block.',
    ],
    estimatedMinutes: 55,
  },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const count = await SystemDesignQuestion.countDocuments();
  console.log(`Current system design question count: ${count}`);

  if (count > 0) {
    console.log('System design bank already populated — skipping seed.');
    await mongoose.disconnect();
    return;
  }

  await SystemDesignQuestion.insertMany(QUESTIONS);
  console.log(`Seeded ${QUESTIONS.length} system design questions.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

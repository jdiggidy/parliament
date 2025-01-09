const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onMessagePublished} = require("firebase-functions/v2/pubsub");
const {defaultConfig, gbConfig, scrapeConfig} = require("../common/functions");
const {onPostShouldFindStories, onPostShouldFindStatements,
  resetPostVector} = require("../ai/post_ai");
const {logger} = require("firebase-functions/v2");
const {
  publishMessage,
  POST_PUBLISHED,
  POST_CHANGED_VECTOR,
  POST_CHANGED_XID,
  POST_SHOULD_FIND_STORIES,
  STORY_CHANGED_POSTS,
  STATEMENT_CHANGED_POSTS,
  POST_CHANGED_STORIES,
  POST_CHANGED_STATEMENTS,
  POST_CHANGED_ENTITY,
  ENTITY_CHANGED_POSTS,
  POST_CHANGED_STATS,
  ENTITY_SHOULD_CHANGE_STATS,
  STORY_SHOULD_CHANGE_STATS,
  PLATFORM_CHANGED_POSTS,
  PLATFORM_SHOULD_CHANGE_STATS,
  POST_SHOULD_CHANGE_CONFIDENCE,
  POST_SHOULD_CHANGE_BIAS,
  POST_SHOULD_CHANGE_VIRALITY,
  POST_CHANGED_VIRALITY,
  STORY_SHOULD_CHANGE_NEWSWORTHINESS,
} = require("../common/pubsub");
const {
  getPost,
  setPost,
  deletePost,
  createNewRoom,
  updatePost,
  getEntity,
  getAllStoriesForPost,
  getPlatform,
  deleteAttribute,
} = require("../common/database");
const {retryAsyncFunction,
  handleChangedRelations,
  getPlatformType,
  isUnsupportedStatus} = require("../common/utils");
const _ = require("lodash");
const {xupdatePost} = require("../content/xscraper");
const {generateCompletions} = require("../common/llm");
const {generateImageDescriptionPrompt} = require("../ai/prompts");
const {tryQueueTask,
  POST_SHOULD_FIND_STORIES_TASK,
  queueTask,
  POST_SHOULD_FIND_STATEMENTS_TASK} = require("../common/tasks");
const {onTaskDispatched} = require("firebase-functions/v2/tasks");
const {didChangeStats,
  onPostShouldChangeVirality} = require("../ai/newsworthiness");
const {onPostShouldChangeConfidence} = require("../ai/confidence");
const {onPostShouldChangeBias} = require("../ai/bias");


exports.onPostUpdate = onDocumentWritten(
    {
      document: "posts/{pid}",
      ...defaultConfig,
    },
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (!before && !after) {
        return Promise.resolve();
      }

      const _create = !before && after;
      const _delete = before && !after;
      const _update = before && after;

      if (_create && after.xid || _update && before.xid != after.xid) {
        await publishMessage(POST_CHANGED_XID,
            {pid: after?.pid || before?.pid});
      }

      if (after && after.status == "published" &&
        (!before || before.status != "published")) {
        await publishMessage(POST_PUBLISHED, {pid: after.pid});
      }

      if (
        _create && after.vector ||
        _delete && before.vector ||
        _update && !_.isEqual(before.vector, after.vector)) {
        await publishMessage(POST_CHANGED_VECTOR,
            {pid: after?.pid || before?.pid});
      }

      if (
        _create && after.eid ||
        _update && before.eid != after.eid ||
        _delete && before.eid
      ) {
        await publishMessage(POST_CHANGED_ENTITY,
            {before: before, after: after});
      }

      if (
        _create && (after.sid || !_.isEmpty(after.sids)) ||
        _update && (before.sid != after.sid ||
          !_.isEqual(before.sids, after.sids)) ||
        _delete && (before.sid || !_.isEmpty(before.sids))
      ) {
        await publishMessage(POST_CHANGED_STORIES,
            {before: before, after: after});
      }

      if (
        _create && !_.isEmpty(after.stids) ||
        _update && !_.isEqual(before.stids, after.stids) ||
        _delete && !_.isEmpty(before.stids)
      ) {
        await publishMessage(POST_CHANGED_STATEMENTS,
            {before: before, after: after});
        await publishMessage(POST_SHOULD_CHANGE_BIAS,
            {pid: after?.pid || before?.pid});
        await publishMessage(POST_SHOULD_CHANGE_CONFIDENCE,
            {pid: after?.pid || before?.pid});
      }

      if (
        _create && after.plid ||
        _update && before.plid != after.plid ||
        _delete && before.plid
      ) {
        await publishMessage(PLATFORM_SHOULD_CHANGE_STATS,
            {plid: after?.plid || before?.plid});
      }

      if (didChangeStats(_create, _update, _delete, before, after, false)) {
        await publishMessage(POST_CHANGED_STATS,
            {before: before, after: after});
      }

      if (_create && after.status || _update && before.status != after.status) {
        // task for findStories is sent on tryQueueTask
        if (after.status == "foundStories") {
          await queueTask(POST_SHOULD_FIND_STATEMENTS_TASK, {pid: after.pid});
        } else if (after.status == "foundStatements" ||
           after.status == "noStatements") {
          await updatePost(after.pid, {status: "found"});
        }
      }

      if (_create && after.virality ||
        _update && before.virality != after.virality ||
        _delete && before.virality) {
        await publishMessage(POST_CHANGED_VIRALITY,
            {pid: before.pid ?? after.pid});
      }

      if (_create && (isUnsupportedStatus(after.status)) ||
        _update && (before.status != after.status &&
          isUnsupportedStatus(after.status))) {
        logger.warn(`Unsupported status: ${after.status}, will not process`);
      }

      if (
        _create && (after.title || after.body || after.photo) ||
        _delete && (before.title || before.body || before.photo) ||
        _update && (
          before.title != after.title ||
          before.body != after.body || !_.isEqual(before.photo, after.photo))
      ) {
        await postChangedContent(before, after);
      }

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// PubSub
// ////////////////////////////////////////////////////////////////////////////

/**
 * optionally calls onPostShouldFindStories if the post is published beforehand
 * @param {Message} message
 * @return {Promise<void>}
 * */
exports.onPostChangedVector = onMessagePublished(
    {
      topic: POST_CHANGED_VECTOR,
      ...defaultConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      const post = await getPost(pid);
      if (!post) {
        return Promise.resolve();
      }

      if (post.status == "published" && post.sid == null) {
        await tryQueueTask(
            "posts",
            pid,
            (post) => post && post.vector &&
            (post.status === "published" || post.status === "found"),
            {status: "findingStories"},
            POST_SHOULD_FIND_STORIES_TASK,
            {pid: pid},
        );
      }

      return Promise.resolve();
    },
);

/**
 * creates the room
 * called when a post is published
 * @param {Message} message
 * @return {Promise<void>}
 */
exports.onPostPublished = onMessagePublished(
    {
      topic: POST_PUBLISHED,
      ...defaultConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      const post = await getPost(pid);

      if (post && post.vector) {
        await tryQueueTask(
            "posts",
            pid,
            (post) => post && post.vector &&
              (post.status === "published" || post.status === "found"),
            {status: "findingStories"},
            POST_SHOULD_FIND_STORIES_TASK,
            {pid: pid},
        );
      }

      await createNewRoom(pid, "posts");

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// Confidence
// ////////////////////////////////////////////////////////////////////////////

exports.onPostShouldChangeConfidence = onMessagePublished(
    {
      topic: POST_SHOULD_CHANGE_CONFIDENCE,
      ...defaultConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      if (!pid) {
        return Promise.resolve();
      }
      logger.info(`onPostShouldChangeConfidence: ${pid}`);

      await onPostShouldChangeConfidence(pid);

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// Bias
// ////////////////////////////////////////////////////////////////////////////

exports.onPostShouldChangeBias = onMessagePublished(
    {
      topic: POST_SHOULD_CHANGE_BIAS,
      ...defaultConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      if (!pid) {
        return Promise.resolve();
      }
      logger.info(`onPostShouldChangeBias: ${pid}`);

      await onPostShouldChangeBias(pid);

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// Newsworthiness
// ////////////////////////////////////////////////////////////////////////////

/**
 * triggers posts to update virality
 * @param {Message} message
 * @return {Promise<void>}
 * */
exports.onPostShouldChangeVirality = onMessagePublished(
    {
      topic: POST_SHOULD_CHANGE_VIRALITY,
      ...gbConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      if (!pid) {
        return Promise.resolve();
      }
      logger.info(`onPostShouldChangeVirality: ${pid}`);

      await onPostShouldChangeVirality(pid);

      return Promise.resolve();
    });

/**
 * triggers stories to update their newsworthiness
 * called when a post changed virality
 * @param {Message} message
 * @return {Promise<void>}
 * */
exports.onPostChangedVirality = onMessagePublished(
    {
      topic: POST_CHANGED_VIRALITY,
      ...defaultConfig,
    },
    async (event) => {
      const pid = event.data.message.json.pid;
      if (!pid) {
        return Promise.resolve();
      }
      logger.info(`onPostChangedVirality: ${pid}`);

      const stories = await getAllStoriesForPost(pid);
      if (!stories) {
        return Promise.resolve();
      }

      for (const story of stories) {
        await publishMessage(STORY_SHOULD_CHANGE_NEWSWORTHINESS,
            {sid: story.sid});
      }

      return Promise.resolve();
    });

// ////////////////////////////////////////////////////////////////////////////
// Content
// ////////////////////////////////////////////////////////////////////////////

/**
 * triggers fetching the post
 * called when a post changed external id
 * @param {Message} message
 * @return {Promise<void>}
 */
exports.onPostChangedXid = onMessagePublished(
    {
      topic: POST_CHANGED_XID,
      ...scrapeConfig,
    },
    async (event) => {
      logger.info(`onPostChangedXid: ${event.data.message.json.pid}`);

      const pid = event.data.message.json.pid;
      const post = await getPost(pid);

      if (!post || !post.xid || !post.plid || !post.eid) {
        return Promise.resolve();
      }
      const entity = await getEntity(post.eid);
      if (!entity) {
        return Promise.resolve();
      }

      const platform = await getPlatform(post.plid);

      if (getPlatformType(platform) == "x") {
        await xupdatePost(post);
      } else {
        return Promise.resolve();
      }

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// Stats
// ////////////////////////////////////////////////////////////////////////////

/**
 * triggers Entity and Stories to update their stats
 * @param {Message} message
 * @return {Promise<void>}
 * */
exports.onPostChangedStats = onMessagePublished(
    {
      topic: POST_CHANGED_STATS,
      ...defaultConfig,
    },
    async (event) => {
      logger.info("onPostChangedStats");
      const before = event.data.message.json.before;
      const after = event.data.message.json.after;
      const post = after || before;

      if (!post) {
        logger.error("No post found for onPostChangedStats");
        return Promise.resolve();
      }

      await publishMessage(POST_SHOULD_CHANGE_VIRALITY, {pid: post.pid});

      await publishMessage(ENTITY_SHOULD_CHANGE_STATS, {eid: post.eid});

      const stories = await getAllStoriesForPost(post.pid);
      if (!stories) {
        logger.warn("No stories found for onPostChangedStats");
        return Promise.resolve();
      }

      for (const story of stories) {
        await publishMessage(STORY_SHOULD_CHANGE_STATS, {sid: story.sid});
      }

      await publishMessage(PLATFORM_SHOULD_CHANGE_STATS, {plid: post.plid});

      return Promise.resolve();
    },
);

// ////////////////////////////////////////////////////////////////////////////
// Content
// ////////////////////////////////////////////////////////////////////////////

/**
 * TXN
 * Transactional update to store vector
 * Not done as pubsub because we need access to the before and after
 * @param {Post} before
 * @param {Post} after
 */
const postChangedContent = async function(before, after) {
  if (!after) {
    return;
  }

  if (before?.photo?.photoURL != after?.photo?.photoURL &&
     after.photo?.photoURL && !after.photo?.description) {
    const resp = await generateCompletions({
      messages: generateImageDescriptionPrompt(after.photo.photoURL),
      loggingText: after.pid + " photoURL",
    });
    if (!resp?.description) {
      logger.error("Error generating image description");
      await retryAsyncFunction(() => updatePost(after.pid, {
        "photo.llmCompatible": false,
      }));
      return;
    } else {
      await retryAsyncFunction(() => updatePost(after.pid, {
        "photo.description": resp.description,
        "photo.llmCompatible": true,
      }));
      return;
    }
  }

  const save = await resetPostVector(after.pid);
  if (!save) {
    logger.error(`Could not save post embeddings: ${after.pid}`);
    if (before) {
      return await retryAsyncFunction(() => setPost(before));
    } else {
      return await retryAsyncFunction(() => deletePost(after.pid));
    }
  }
};

// ////////////////////////////////////////////////////////////////////////////
// FIND STORIES AND STATEMENTS
// ////////////////////////////////////////////////////////////////////////////

exports.onPostShouldFindStoriesTask = onTaskDispatched(
    {
      retryConfig: {
        maxAttempts: 2,
      },
      rateLimits: {
        maxConcurrentDispatches: 1,
      },
      ...gbConfig,
    },
    async (event) => {
      logger.info(
          `onPostShouldFindStoriesTask: ${event.data.pid}`);
      const pid = event.data.pid;
      await _shouldFindStories(pid);
      return Promise.resolve();
    },
);

/**
 * Finds stories and statements for a post
 * @param {Message} message
 * @return {Promise<void>}
 * */
exports.onPostShouldFindStories = onMessagePublished(
    {
      topic: POST_SHOULD_FIND_STORIES,
      ...gbConfig,
    },
    async (event) => {
      logger.info(`onPostShouldFindStoriesPubsub: 
        ${event.data.message.json.pid}`);
      const pid = event.data.message.json.pid;
      await _shouldFindStories(pid);
      return Promise.resolve();
    },
);

const _shouldFindStories = async function(pid) {
  const post = await getPost(pid);
  await onPostShouldFindStories(post);

  return Promise.resolve();
};
exports.shouldFindStories = _shouldFindStories;

exports.onPostShouldFindStatementsTask = onTaskDispatched(
    {
      retryConfig: {
        maxAttempts: 2,
      },
      rateLimits: {
        maxConcurrentDispatches: 1,
      },
      ...gbConfig,
    },
    async (event) => {
      logger.info(
          `onPostShouldFindStatementsTask: ${event.data.pid}`);
      const pid = event.data.pid;
      await _shouldFindStatements(pid);
      return Promise.resolve();
    },
);

const _shouldFindStatements = async function(pid) {
  const post = await getPost(pid);
  await onPostShouldFindStatements(post);

  return Promise.resolve();
};
exports.shouldFindStatements = _shouldFindStatements;


// ////////////////////////////////////////////////////////////////////////////
// Sync
// ////////////////////////////////////////////////////////////////////////////

/**
 * 'TXN' - called from story.js
 * Updates the stories that this Post is part of
 * @param {Story} before
 * @param {Story} after
 */
exports.onStoryChangedPosts = onMessagePublished(
    {
      topic: STORY_CHANGED_POSTS,
      ...defaultConfig,
    },
    async (event) => {
      const before = event.data.message.json.before;
      const after = event.data.message.json.after;
      await handleChangedRelations(before, after,
          "pids", updatePost, "sid", "sids");
      await handleChangedRelations(before, after,
          "pids", updatePost, "sid", "sid", {}, "manyToOne");
      return Promise.resolve();
    },
);

/**
 * 'TXN' - called from Statement.js
 * Updates the Statements that this Post is part of
 * @param {Statement} before
 * @param {Statement} after
 */
exports.onStatementChangedPosts = onMessagePublished(
    {
      topic: STATEMENT_CHANGED_POSTS,
      ...defaultConfig,
    },
    async (event) => {
      const before = event.data.message.json.before;
      const after = event.data.message.json.after;
      await handleChangedRelations(before,
          after, "pids", updatePost, "stid", "stids");
      return Promise.resolve();
    },
);

/**
 * 'TXN' - called from Entity.js
 * Updates the Post
 * @param {Entity} before
 * @param {Entity} after
 */
exports.onEntityChangedPosts = onMessagePublished(
    {
      topic: ENTITY_CHANGED_POSTS, // Make sure to define this topic
      ...defaultConfig,
    },
    async (event) => {
      const before = event.data.message.json.before;
      const after = event.data.message.json.after;
      await handleChangedRelations(before, after,
          "pids", updatePost, "eid", "eid", {}, "manyToOne");
      return Promise.resolve();
    },
);

/**
 * 'TXN' - called from Platform.js
 * Updates the Post
 * @param {Platform} before
 * @param {Platform} after
 */
exports.onPlatformChangedPosts = onMessagePublished(
    {
      topic: PLATFORM_CHANGED_POSTS, // Make sure to define this topic
      ...defaultConfig,
    },
    async (event) => {
      const before = event.data.message.json.before;
      const after = event.data.message.json.after;

      if (before && !after) {
        await deleteAttribute("posts", "plid", "==", before.plid);
      }

      return Promise.resolve();
    },
);

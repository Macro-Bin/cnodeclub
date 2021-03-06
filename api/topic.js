/**
 * 暴露 Topic 相关的 API
 * @author heroic
 */

/**
 * Module dependencies
 */
var async = require('async'),
  _ = require('lodash'),
  marked = require('../utils/marked'),
  models = require('../models'),
  Topic = models.Topic;

/**
 * 处理话题内容中的 @
 * @param  {String} content 话题内容
 * @return {String}   将 @ 替换成 markdown 链接标记之后的内容
 */
function parseMention(content) {
  return content.replace(/@([a-zA-Z0-9\-_]+)\s?/g, function(group, p1) {
    return _.template('[@<%= username %>](/user/<%= username %>) ', {
      username: p1
    });
  });
}

/**
 * 获取话题列表
 * @param  {Object}   options
 *  - query          optional   查询条件，默认查询全部
 *  - notPaged       optional   不分页则传入 true，默认 false
 *  - pageIndex      optional   当前页数，默认 1
 *  - pageSize       optional   返回的记录数，默认 20
 *  - sort  {Object} optional   排序规则，默认按创建时间倒序
 * @param  {Function} callback
 *  - err
 *  - results
 *    - totalCount    符合查询条件话题记录总数
 *    - topics        话题列表
 */
exports.query = function(options, callback) {
  options = options || {};
  var conditions = options.query || options.conditions || {};

  Topic.paginate(conditions, options, function(err, count, topics) {
    if (err) {
      return callback(err);
    }

    // `notPaged === true` 的情况
    if (typeof topics === 'undefined') {
      return callback(null, { topics: count });
    }

    callback(null, {
      totalCount: count,
      topics: topics
    });
  });
};

/**
 * 发布新话题
 * @param  {Object}   topicData 话题对象
 * @param  {Function} callback
 *  - err
 */
exports.create = function(topicData, callback) {
  async.waterfall([
    function processMarkdown(next) {
      var content = topicData.content;
      content = parseMention(content);
      marked(content, function(err, contentHtml) {
        next(err, contentHtml);
      });
    },
    function createTopic(contentHtml, next) {
      topicData.contentHtml = contentHtml;
      Topic.create(topicData, function(err) {
        next(err);
      });
    }
  ], callback);
};

/**
 * 编辑话题
 * @param  {Object}   topicData 话题对象
 * @param  {Function} callback
 *  - err
 */
exports.edit = function(topicData, callback) {
  async.waterfall([
    function processMarkdown(next) {
      var content = topicData.content;
      content = parseMention(content);
      marked(content, function(err, contentHtml) {
        next(err, contentHtml);
      });
    },
    function updateTopic(contentHtml, next) {
      topicData.contentHtml = contentHtml;
      Topic.edit(topicData, function(err) {
        return next(err);
      });
    }
  ], callback);
};

/**
 * 根据 id 获取话题
 * @param  {Object}   args   
 *  - id      required   话题 id
 *  - isView  optional   是否为查看话题。是则将话题的浏览数+1
 * @param  {Function} callback
 *  - err
 *  - topic   话题对象
 */
exports.get = function(args, callback) {
  var id = args.id,
    userId = this.currentUser && this.currentUser.id,
    isView = typeof args.isView !== 'undefined' ? args.isView : false;

  async.waterfall([
    function getTopic(next) {
      if (isView) {
        Topic.findByIdAndUpdate(id, {
          $inc: {
            viewsCount: 1
          }
        }, function(err, topic) {
          next(err, topic);
        });
      } else {
        Topic.findById(id, function(err, topic) {
          next(err, topic);
        });
      }
    },
    function checkFavorite(topic, next) {
      if (!userId || !topic) {
        return next(null, topic);
      }
      topic.isFavoritedBy(userId, function(err, favorited) {
        if (err) {
          return next(err);
        }
        next(null, _.extend(topic, {
          isFavorited: favorited
        }));
      });
    }
  ], callback);
};

/**
 * 统计话题数量
 * @param  {Object}   conditions  过滤条件
 * @param  {Function} callback
 *  - err
 *  - count
 */
exports.count = function(conditions, callback) {
  Topic.count(conditions, callback);
};

/**
 * 切换优质话题状态
 * @param  {Object}   args
 *  - id   required   话题 id
 * @param  {Function} callback
 *  - err
 *  - topic
 */
exports.toggleExcellent = function(args, callback) {
  var id = args.id;
  Topic.findById(id, function(err, topic) {
    if (err) {
      return callback(err);
    }
    if (!topic) {
      return callback(null, topic);
    }
    topic.update({
      excellent: !topic.excellent
    }, callback);
  });
};

/**
 * 删除话题
 * @param  {Object}   args
 *  - id   required   话题 id
 * @param  {Function} callback
 */
exports.remove = function(args, callback) {
  Topic.destroy(args.id, callback);
};
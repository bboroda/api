/**
 * @module domain/profile
 * @version 1.0.0
 * @author Peter Schmalfeldt <me@peterschmalfeldt.com>
 */

var _ = require('lodash');
var State = require('../../../models/civil_services/state');
var util = require('./util');
var config = require('../../../config');
var elasticsearchClient = require('../../../elasticsearch/client');
var Promise = require('bluebird');
var validator = require('validator');

var env = config.get('env');
var indexType = env + '_state';
var indexName = config.get('elasticsearch.indexName') + '_' + indexType;

var DEFAULT_PAGE_SIZE = 30;

/**
 * Domain Profile
 * @type {object}
 */
module.exports = {
  /**
   * Prepare For API Output
   * @param {object} data - Data to be processed for API Output
   * @return {object}
   */
  prepareForAPIOutput: function(data) {
    var fields = [
      'state_name',
      'state_name_slug',
      'state_code',
      'state_code_slug',
      'nickname',
      'website',
      'admission_date',
      'admission_number',
      'capital_city',
      'capital_url',
      'population',
      'population_rank',
      'constitution_url',
      'state_flag_url',
      'state_seal_url',
      'map_image_url',
      'landscape_background_url',
      'skyline_background_url',
      'twitter_handle',
      'twitter_url',
      'facebook_url'
    ];

    return _.pick(data._source, fields);
  },

  /**
   * Prepare For Elastic Search
   * @param {object} data - Data to be Processed for Elastic Search
   * @return {object}
   */
  prepareForElasticSearch: function(data) {
    return {
      state_name: data.state_name,
      state_name_slug: data.state_name_slug,
      state_code: data.state_code,
      state_code_slug: data.state_code_slug,
      nickname: data.nickname,
      website: data.website,
      admission_date: data.admission_date,
      admission_number: data.admission_number,
      capital_city: data.capital_city,
      capital_url: data.capital_url,
      population: data.population,
      population_rank: data.population_rank,
      constitution_url: data.constitution_url,
      state_flag_url: data.state_flag_url,
      state_seal_url: data.state_seal_url,
      map_image_url: data.map_image_url,
      landscape_background_url: data.landscape_background_url,
      skyline_background_url: data.skyline_background_url,
      twitter_handle: data.twitter_handle,
      twitter_url: data.twitter_url,
      facebook_url: data.facebook_url,
      shape: data.shape
    };
  },

  /**
   * Get State
   * @param {number} state - State
   * @returns {*}
   */
  getState: function(state) {
    if (state) {
      return State.findOne({
          where: {
            $or: {
              state_name: state,
              state_name_slug: state,
              state_code: state
            }
          },
          order: [
            [
              'created_date', 'DESC'
            ]
          ]
        })
        .then(function(state) {
          if (state) {
            return {
              state_name: state.state_name,
              state_name_slug: state.state_name_slug,
              state_code: state.state_code,
              state_code_slug: state.state_code_slug,
              nickname: state.nickname,
              website: state.website,
              admission_date: state.admission_date,
              admission_number: state.admission_number,
              capital_city: state.capital_city,
              capital_url: state.capital_url,
              population: state.population,
              population_rank: state.population_rank,
              constitution_url: state.constitution_url,
              state_flag: {
                large: state.state_flag_url,
                small: state.state_flag_url.replace('-large.png', '-small.png')
              },
              state_seal: {
                large: state.state_seal_url,
                small: state.state_seal_url.replace('-large.png', '-small.png')
              },
              map: {
                large: state.map_image_url,
                small: state.map_image_url.replace('-large.png', '-small.png')
              },
              landscape: {
                size_640x360: state.landscape_background_url.replace('1280x720', '640x360'),
                size_960x540: state.landscape_background_url.replace('1280x720', '960x540'),
                size_1280x720: state.landscape_background_url,
                size_1920x1080: state.landscape_background_url.replace('1280x720', '1920x1080')
              },
              skyline: {
                size_640x360: state.skyline_background_url.replace('1280x720', '640x360'),
                size_960x540: state.skyline_background_url.replace('1280x720', '960x540'),
                size_1280x720: state.skyline_background_url,
                size_1920x1080: state.skyline_background_url.replace('1280x720', '1920x1080')
              },
              twitter_handle: state.twitter_handle,
              twitter_url: state.twitter_url,
              facebook_url: state.facebook_url
            };
          } else {
            return Promise.reject('No found for ' + state);
          }
        });
    } else {
      return Promise.reject('Request Invalid');
    }
  },

  /**
   * Get State
   * @param {object} query - GET Parameters
   * @returns {*}
   */
  search: function (query) {

    // Defaults
    var andFilters;
    var pageSize = DEFAULT_PAGE_SIZE;
    var page = 1;
    var self = this;
    var searchParams = {
      index: indexName,
      type: indexType,
      sort: 'state_name',
      body: {}
    };

    function getAndFilters() {
      if (!_.get(searchParams, 'body.query.bool.must')) {
        _.set(searchParams, 'body.query.bool.must', []);
      }

      return _.get(searchParams, 'body.query.bool.must');
    }

    function setGeoFilters(filter) {
      if (!_.get(searchParams, 'body.query.filtered.filter')) {
        _.set(searchParams, 'body.query.filtered.filter', filter);
      }
    }

    // Page size
    if (query.pageSize && validator.isInt(query.pageSize) && validator.toInt(query.pageSize, 10) >= 1) {
      pageSize = validator.toInt(query.pageSize, 10);
    }

    searchParams.size = pageSize;

    // Determine Page
    if (query.page && validator.isInt(query.page) && validator.toInt(query.page, 10) >= 1) {
      page = validator.toInt(query.page, 10);
    }

    searchParams.from = (page - 1) * searchParams.size;

    /**
     * Filter By State Name
     */
    if (query.name) {
      andFilters = getAndFilters();
      andFilters.push({
        match: {
          state_name: query.name
        }
      });
    }

    /**
     * Filter By State Slug
     */
    if (query.slug) {
      andFilters = getAndFilters();
      andFilters.push({
        match: {
          state_name_slug: query.slug
        }
      });
    }

    /**
     * Filter By State Code
     */
    if (query.code) {
      andFilters = getAndFilters();
      andFilters.push({
        match: {
          state_code: query.code
        }
      });
    }

    /**
     * Filter By State Nickname
     */
    if (query.nickname) {
      andFilters = getAndFilters();
      andFilters.push({
        match: {
          nickname: query.nickname
        }
      });
    }

    /**
     * Filter By Minimum Population
     */
    if (query.minPopulation) {
      andFilters = getAndFilters();
      andFilters.push({
        range: {
          population: {
            gte: parseInt(query.minPopulation, 0)
          }
        }
      });
    }

    /**
     * Filter By Maximum Population
     */
    if (query.maxPopulation) {
      andFilters = getAndFilters();
      andFilters.push({
        range: {
          population: {
            lte: parseInt(query.maxPopulation, 0)
          }
        }
      });
    }

    /**
     * Filter By Minimum Population
     */
    if (query.admittedBefore) {
      andFilters = getAndFilters();
      andFilters.push({
        range: {
          admission_date: {
            lte: query.admittedBefore
          }
        }
      });
    }

    /**
     * Filter By Maximum Population
     */
    if (query.admittedAfter) {
      andFilters = getAndFilters();
      andFilters.push({
        range: {
          admission_date: {
            gte: query.admittedAfter
          }
        }
      });
    }

    /**
     * Filter By Latitude, Longitude & Distance
     */
    if (query.latitude && query.longitude) {
      setGeoFilters({
        geo_shape: {
          shape: {
            shape: {
              coordinates: [
                query.longitude,
                query.latitude
              ],
              type: 'point'
            }
          }
        }
      });
    }

    return elasticsearchClient.search(searchParams)
      .then(function(result) {
        return {
          meta: {
            total: result.hits.total,
            showing: result.hits.hits.length,
            pages: Math.ceil(result.hits.total / searchParams.size),
            page: page
          },
          data: result.hits.hits.map(self.prepareForAPIOutput)
        };
      })
      .catch(function(error) {
        return util.createAPIResponse({
          errors: [error]
        });
      });
  }
};

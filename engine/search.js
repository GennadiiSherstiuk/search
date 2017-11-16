/* global module: true*/
/*jslint node: true */
/*jshint unused: vars*/
/*jslint camelcase: false */
// //sorting results
// var sort = require('./sort_results');
(function () {
   'use strict';
   require(__dirname + '/../serverScripts/amd-loader/amd-loader.js');
   var fs = require('fs');
   var _ = require('underscore');
   var unidecode = require('unidecode');
   var _str = require("underscore.string");
   var q = require('q');
   var handlebars = require('handlebars');
   var handlebarsTemplate = null;
   
   var config = require(__dirname + '/../utils/configReader.js');
   var languageUtils = require('./../utils/languageUtils.js');
   var searchUtils = require(__dirname + '/searchUtils');
   var searchCommonUtils = require('../../shared/searchUtils');

   var sort = require(__dirname + '/sort_results');
   var utils = require('../utils/utils.js');
   var logger = require(__dirname + '/../utils/logger.js').getLogger(__filename);

   var clientsToFacet = {ool : 'ocean_of_lights'}; // Should be moved to outer config!
   var MAX_LENGHT_IPA_WORD = 8;
   module.exports = function (prvd) {

      var providers = prvd;
      /**
       * @param  {string} clientID
       * @return {Object} provider
       */
      function getProviderByClientID(clientID) {
        var provider;
        if (clientID && clientsToFacet[clientID] && providers[clientsToFacet[clientID]]) {
           provider = providers[clientsToFacet[clientID]];
        }
        else {
           if(clientID){
              logger.error('ClientID: ' + clientID + ' not found');
           }
           provider = providers.default;
        }
        return provider;
      }

      /**
       * @param  {string} query
       * @param  {Object} params consist of language, optional bookId clientID publicationPath
       * @param  {runId} runId optional
       * @return {Promise} searchResult
       */
      function search(query, params, runId) {
         var searchResult = {
               rows : [],
               stems : []
            },
            queryParamsDef = {
               quotes : [],
               notWords : [],
               metaData : [],
               queryWords: [],
               standAloneWords : [],
               quotesWords : [],
               phonemeWords : []
            },
            queryParams = {};

         params = params || {
            lang : 'en'
         }; // default language if no one is set

         var provider =  getProviderByClientID(params.clientID);
         var sortTestFunc;
         if (params.publicationPath && !params.bookId) {
            sortTestFunc = function (el) {
               return (el.originalPath && el.originalPath.htm && params.publicationPath.indexOf(el.originalPath.htm) > -1);
            };
         }

         queryParams = parseQuery(query, params.lang);
         _.defaults(queryParams, queryParamsDef);


          var isValidQueryMeta = provider.validateQueryMeta(queryParams.metaData, params.lang);
          if (!isValidQueryMeta) {
            return q.when(searchResult);
          }

         if (!params.lang || (queryParams.standAloneWords.length === 0 && queryParams.quotesWords.length === 0 && queryParams.phonemeWords.length === 0)) {
            return q.when(searchResult);
         }

         return searchEngine(queryParams, params, provider)
            .then(function (searchResponse) {
               var sentences = searchResponse.sentences;
               var booksMeta = [],
                  bookIds = [];

               bookIds = getUniqParams(sentences, 'bookId');
               booksMeta = provider.getBooksMetaData(bookIds, queryParams.metaData, params.lang);
               if (params.bookId.length === 0 && sentences.length !== 0) {
                  return createBookList(sentences, booksMeta, runId, sortTestFunc);
               }
               else if (params.bookId.length > 0 && sentences.length !== 0) {
                  return createSentencesListByPublication(
                     sentences, booksMeta,
                     queryParams.quotes, searchResponse.searchWords,
                     params.lang, provider
                  );
               }
               else {
                  return searchResult;
               }
            })
            .then(function (searchResponse) {
               return searchResponse;
            })
            .catch(function(err){
              logger.error(err);
              return;
            });
      }
      /**
       * @param  {string} start is position in bytes of sentence objects in file sentences.json
       * @param  {string} len is length in byts of sentence object in file sentences.json
       * @param  {string} clientID
       * @return {object} moreTextResponse is object include html with more text for search result
       */
      function getMoreText(start, len, clientID) {
        var provider =  getProviderByClientID(clientID);
        var moreTextResponse = {
         text: ''
        };

        return provider.readSentencesDocuments(start, len)
           .then(function(sentencesObjects){
               var groupedSentencesObjects = groupSentencesObjectsByParagraph(sentencesObjects);
               moreTextResponse.text = _.map(groupedSentencesObjects, function(groupedSentencesObject){
                 return createHTML(groupedSentencesObject.paragraphText,
                                   groupedSentencesObject.paragraphs,
                                   groupedSentencesObject.locator,
                                   groupedSentencesObject.tag);
               }).join('');
               return moreTextResponse;
           })
           .catch(function() {
             return moreTextResponse;
           });
      }

      function groupSentencesObjectsByParagraph(sentencesObjects) {
         var groupedSentencesObjects = [];
         var currentSentencesObjects = sentencesObjects.shift();
         currentSentencesObjects.paragraphText = currentSentencesObjects.text;
         _.each(sentencesObjects, function(sentencesObject) {
            if (currentSentencesObjects.locator === sentencesObject.locator) {
               currentSentencesObjects.paragraphText += ' ' + sentencesObject.text;
            }
            else {
               groupedSentencesObjects.push(currentSentencesObjects);
               currentSentencesObjects = _.clone(sentencesObject);
               currentSentencesObjects.paragraphText = sentencesObject.text;
            }
         });
         groupedSentencesObjects.push(currentSentencesObjects);
         return groupedSentencesObjects;
      }

      function createPara(text, paragraph, locator) {
         return '<p data-id="' + (paragraph || '') + '" id="' + locator + '">' + text + ' </p>';
      }

      function createTitle(text, tag) {
         return '<' + tag + '>' + text + ' </' + tag + '>';
      }

      function createHTML(text, paragraph, locator, tag) {
         return tag && tag.indexOf('h') !== -1 ?
               createTitle(text, tag) :
               createPara(text, paragraph, locator);
      }

      /**
       * @param  {String} query is search query
       * @param  {String} lang current language in search query
       * @return {Object} queryParams parse search query
       */
      function parseQuery(query, lang) {
         var quotesWords,
            blackList,
            standAloneWords,
            phonemeWords;
         var parsedQuery = searchCommonUtils.parseQuery(query, config.searchConfig, lang);

         var queryWords = parsedQuery.queryWords.join(' ');
         queryWords = languageUtils.tokenizing(queryWords, lang);
         queryWords = languageUtils.removeStopWord(queryWords, lang);
         queryWords = _.map(queryWords, function (word) {
            return word.toLowerCase();
         });

         standAloneWords = languageUtils.getStems(parsedQuery.queryWords.join(' '), 'en');

         if(lang === 'ar' || lang === 'fa'){
            [].push.apply(standAloneWords, languageUtils.getStems(parsedQuery.standAloneWords.join(' '), lang));
         }

         phonemeWords = getPhonemeWords(query, lang);

         quotesWords = languageUtils.getStems(parsedQuery.quotes.join(' '), lang);
         blackList = _.map(parsedQuery.blackList, function(word) {
            return word.replace(/^\s*-/, '').trim();
         });
         blackList = languageUtils.tokenizing(blackList.join(' '), lang);
         blackList = languageUtils.removeStopWord(blackList, lang);
         return {
            quotes: parsedQuery.quotes,
            notWords: blackList,
            metaData: parsedQuery.metaData,
            standAloneWords: standAloneWords,
            queryWords: queryWords,
            quotesWords: quotesWords,
            phonemeWords: phonemeWords
         };
      }

      function createSentenceBlackList(sentenceIndexObjs) {
         var sentenceBlackList = utils.uniqueElements(flatten(sentenceIndexObjs.sentenceIndexes));
         sentenceBlackList = _.map(sentenceBlackList, function(sentence){
            return sentence.split(':')[0];
         });
         return sentenceBlackList;
      }

      /**
       * @param  {Object} queryParams parsed quary
       * @param  {Object} params quaru params
       * @param  {Object} provider perform access to search index
       * @return {Object} searchResult
       */
      function searchEngine(queryParams, params, provider) {
         var phoneticWords = [];
         var _stemSentences = [];
         var intersection = [];
         var wordForms = [];
         var phoneticCodes = [];


         var positiveSearch = queryParams.standAloneWords;
         var phoneticBlackList = queryParams.quotesWords;

         return q.all([performSearch(positiveSearch, provider, params.lang, true, phoneticBlackList),
                       performSearch(queryParams.notWords, provider, params.lang, false)])
           .spread(function(positiveSentence, negativeSentence){

            phoneticWords = positiveSentence.notFoundWords.soundEx.concat(positiveSentence.notFoundWords.ipa);
            phoneticCodes = createPhoneticCodes(positiveSentence.notFoundWords.soundEx, params.lang);

            var sentenceBlackList = createSentenceBlackList(negativeSentence.sentenceIndexObjs);
            if (params.bookId && sentenceBlackList.length !== 0) {
               sentenceBlackList = filterByBookId(sentenceBlackList, params.bookId, []);
            }

            intersection = arrayIntersect(positiveSentence.sentenceIndexObjs, sentenceBlackList, params.bookId, queryParams, params.lang);

            if (!params.bookId && phoneticWords.length === 0 && queryParams.quotesWords.length === 0) {
               return {
                  sentences: intersection.sentenceIndexesObjects,
                  searchWords: []
               };
            }
            else {

               return provider.getSentenceDocumentsByIndexes(intersection.sentenceIndexes)
                  .then(function(sentences) {
                     sentences = addIntersectInfo(sentences, intersection.sentenceIndexesObjects);
                     var searchWords = [];
                     var arabicWordsDict = {};
                     var arabicStems = [];
                     _stemSentences = sentences;
                     searchWords = positiveSearch.concat(phoneticCodes);
                     _.each(searchWords, function(word){
                        [].push.apply(wordForms, _.keys(provider.getWordFormsByWord(params.lang, word)));
                     });
                     if(phoneticWords.length !== 0){
                        if (params.lang === 'ar' || params.lang === 'fa') {
                           arabicWordsDict = generateArabicSearchStems(positiveSentence.notFoundWords.ipa, params.lang);
                           arabicStems = getSearchArabicStems(arabicWordsDict, params.lang);
                           [].push.apply(searchWords, arabicStems);
                           return {
                              filtredSentences: sentences,
                              searchWords: searchWords
                           };
                        }
                        else if (params.lang === 'en'){
                           return q.when(phoneticFilter(sentences, wordForms, phoneticWords, params.lang, provider, params.bookId));
                        }
                     }
                  })
                  .then(function(filtredObj) {
                     var searchWords = queryParams.standAloneWords;
                     if(filtredObj && filtredObj.filtredSentences) {
                        _stemSentences = filtredObj.filtredSentences;
                     }

                     if(filtredObj && filtredObj.searchWords) {
                        [].push.apply(searchWords, filtredObj.searchWords);
                     }

                     _stemSentences = filterSentenseByQuotes(_stemSentences, queryParams.quotes, params.lang);
                     return {
                        sentences : _stemSentences,
                        searchWords: searchWords
                     };
                  });
            }
         });
      }

      function calculateSentenceRelevant(exactMatch, exactOrder, priority) {
         return exactMatch * 0.5 + exactOrder * 0.3 + (priority / 500) * 0.2;
      }

      /**
       * @param  {Array} sentences
       * @param  {Object} booksMeta
       * @param  {string} runId
       * @param  {function} sortTestFunc
       * @return {finalBookList} finalBookList
       */
      function createBookList(sentences, booksMeta, runId, sortTestFunc) {
         var rawBooksList,
            booksData;

         var finalBookList = {
            rows : []
         };

         var booksDataObj = {};
         var priority = 0;
         _.each(sentences, function (sentence) {
            if (booksDataObj[sentence.bookId]) {
               booksDataObj[sentence.bookId].total_rows += 1;
            }
            else {
               booksDataObj[sentence.bookId] = {
                  relevant: 0,
                  bookId : sentence.bookId,
                  total_rows : 1
               };

            }
            var maxRelevant = booksDataObj[sentence.bookId].relevant;
            
            if (booksMeta[sentence.bookId]) {
              priority = parseInt((booksMeta[sentence.bookId].doc.meta.priority || 0), 10);
            }
            priority = isNaN(priority) ? 0 : priority;
            var currentRelevant = calculateSentenceRelevant(sentence.exactMatch, sentence.exactOrder, priority);
            if (maxRelevant < currentRelevant) {
               maxRelevant = currentRelevant;
            }

            booksDataObj[sentence.bookId].relevant = maxRelevant;
         });
         booksData = _.values(booksDataObj);

         rawBooksList = _.filter(booksData, function (book) {
            return booksMeta[book.bookId];
         }).map(function (book) {
            var priority,
               bookAuthor = '<empty>'; //TODO: remove when all author in meta

            var originalHtm = booksMeta[book.bookId].doc.meta.originalHtm,
               originalPdf = booksMeta[book.bookId].doc.meta.originalPdf,
               originalDoc = booksMeta[book.bookId].doc.meta.originalDoc,
               emptyOriginalPath = {
                  htm : '',
                  pdf : '',
                  doc : ''
               };

            var originalPath = originalHtm || originalPdf || originalDoc ? {
               htm : originalHtm || '',
               pdf : originalPdf || '',
               doc : originalDoc || ''
            } : emptyOriginalPath;

            if (booksMeta[book.bookId].doc.meta.author) {
               bookAuthor = unidecode(booksMeta[book.bookId].doc.meta.author);
               bookAuthor = bookAuthor.replace(/\W+/g, '').replace(/\s+/g, '').toLowerCase();
            }
            priority = parseInt(booksMeta[book.bookId].doc.meta.priority, 10);
            priority = isNaN(priority) ? 0 : priority;
            return {
               _id : booksMeta[book.bookId].doc.globalId,
               bookId : book.bookId,
               type : _str.capitalize(booksMeta[book.bookId].doc.meta.type), //TODO: remove capitalize after fix in lib-processor
               title : booksMeta[book.bookId].doc.bookName,
               author : booksMeta[book.bookId].doc.meta.author,
               cover : booksMeta[book.bookId].doc.meta.cover,
               totalResults : book.total_rows,
               relevant : book.relevant,
               originalPath : originalPath
            };
         });

         if (rawBooksList.length === 0) {
            return q.when(finalBookList);
         }
         else {
            return sort.sortBook(rawBooksList, runId, sortTestFunc).then(function (result) {
               finalBookList.rows = result;
               return finalBookList;
            });
         }
      }

      /**
       * @param  {Array} sentences
       * @param  {Object} booksMeta
       * @param  {Array} quotes
       * @param  {Array} searchWords
       * @param  {string} lang
       * @param  {Object} provider
       * @return {Array} sentencesList
       */
      function createSentencesListByPublication(sentences, booksMeta, quotes, searchWords, lang, provider) {
         var stems = [],
            quoteWords = [];

         var sentencesList = {
            rows : [],
            stems : [],
            quotes : []
         };
         sentencesList.rows = sentences;
         var wordForms = flatten(_.map(searchWords, function(word){
            return _.keys(provider.getWordFormsByWord(lang, word));
         }));
         stems = filterStemsBySentences(sentences, wordForms, lang);
         sentencesList.rows = _.filter(sentencesList.rows, function (sentenceData) {
            return _.has(booksMeta, sentenceData.bookId);
         })
            .map(function (sentenceData) {
               var priority = parseInt(booksMeta[sentenceData.bookId].doc.meta.priority, 10);
               priority = isNaN(priority) ? 0 : priority;
               var currentRelevant = calculateSentenceRelevant(sentenceData.exactMatch, sentenceData.exactOrder, priority);
               // delete sentenceData.exactMatch;
               // delete sentenceData.exactOrder;

               return _.extend(sentenceData, {
                  bookId : booksMeta[sentenceData.bookId].doc.globalId,
                  bookName : booksMeta[sentenceData.bookId].doc.bookName,
                  localId : booksMeta[sentenceData.bookId].doc._id,
                  relevant : currentRelevant
               });
            });

         quoteWords = _.map(quotes, function(quote) {
            var words = languageUtils.tokenizing(quote.toLowerCase(), lang);
            return _.map(words, function(word) {
               var cleanWord = languageUtils.replaceDiacritic(word, lang);
               var stem = languageUtils.stemmer(cleanWord, lang);
               var forms = [];
               var wordForms = provider.getWordFormsByWord(lang, stem);
               if(!_.isEmpty(wordForms)){
                 var quoteWordForms = filteredWordsByDiacritic(_.keys(wordForms), cleanWord.toLowerCase(), lang);
                 forms = forms.concat(quoteWordForms, [word, cleanWord]);
               }
               else{
                  forms = [word, cleanWord];
               }
               return utils.uniqueElements(forms);
            });
         });
         sentencesList.quotes = quoteWords || [];
         sentencesList.stems = utils.uniqueElements(stems);
         sentencesList = sort.sortSentence(sentencesList, quotes, lang);
         return sentencesList;
      }

      function orderedBySearchKeys(searchStems, searchResults, lang) {
         var orderedResult = _.map(searchStems, function(searchStem) {
            var searchObj = _.findWhere(searchResults.intersectStem, {key: searchStem});
            if (searchObj) {
              return searchObj;
            }
            var stem = languageUtils.replaceDiacritic(searchStem.split('_')[1], lang);
            var phoneme = languageUtils.getPhoneme(stem, lang);
            searchObj = _.findWhere(searchResults.intersectPhoneme, {key: lang + '_' + phoneme});
            if (searchObj) {
              return searchObj;
            }

            searchObj = _.findWhere(searchResults.intersectPhoneme, {key: searchStem});
            if (searchObj) {
              return searchObj;
            }
            else {
              console.log('Not found word');
            }
         });
         orderedResult = _.compact(orderedResult);
         return orderedResult;
      }

      /**
       * @param  {Array} words
       * @param  {Object} provider
       * @param  {string} lang
       * @param  {Boolean} isNeedNotFoundWords
       * @param  {Array} phoneticBlackList
       * @return {Object} sentenceResults
       */
      function performSearch(words, provider, lang, isNeedNotFoundWords, phoneticBlackList){
         var searchStems = createSearchArray(lang, words),
             sentenceIndexObjs = [],
             notFoundWords = [],
             phoneticCodes = [],
             intersectStem = [],
             intersectPhoneme = [],
             wordsBySoundType = {
               soundEx: [],
               ipa: []
            };
         phoneticBlackList = phoneticBlackList || [];
         return getWordObjects(searchStems, 'stem', provider)
         .then(function(searchResponse){
            notFoundWords = _.filter(searchResponse.notFoundWords, function(word) {
               return phoneticBlackList.indexOf(word) === -1;
            });

            intersectStem = searchResponse.searchResults;
            if (notFoundWords.length !== 0) {
               if (lang === 'ar' || lang === 'fa') {
                  wordsBySoundType = groupedWordByLength(notFoundWords, MAX_LENGHT_IPA_WORD);
               }
               else if (lang === 'en') {
                  wordsBySoundType = {
                     soundEx: notFoundWords
                  };
               }
               else {
                  throw new Error('Language not found in function performSearch');
               }
               _.defaults(wordsBySoundType, {soundEx: [], ipa: []});
               phoneticCodes = createSearchArray(lang, createPhoneticCodes(wordsBySoundType.soundEx, lang));
               return getWordObjects(phoneticCodes, 'phoneme', provider)
                     .then(function(searchResponse){
                        intersectPhoneme = searchResponse.searchResults;
                        if(lang === 'ar' || lang === 'fa') {
                           return searchByGenerateArabicWords(wordsBySoundType.ipa, lang, provider);
                        }
                     })
                     .then(function(searchResponse){
                        if(searchResponse && searchResponse.ipaIntersectPhoneme.length) {
                           [].push.apply(intersectPhoneme, searchResponse.ipaIntersectPhoneme);
                        }
                        var searchResults = {
                           intersectStem: intersectStem,
                           intersectPhoneme: intersectPhoneme
                        };
                        searchResults = orderedBySearchKeys(searchStems, searchResults, lang);
                        sentenceIndexObjs = mergeSearchResult(searchResults);
                        return {
                           sentenceIndexObjs: sentenceIndexObjs,
                           notFoundWords: wordsBySoundType,
                        };
                     });
            }
            return {
               sentenceIndexObjs: mergeSearchResult(intersectStem),
               notFoundWords: wordsBySoundType,
            };
         });
      }


      /*
        secondary functions
      */


     /**
      * @param  {Array} sentences
      * @param  {object} sentencesObjects
      * @return {Array} sentences
      */
      function addIntersectInfo(sentences, sentencesObjects) {
         sentences = _.map(sentences, function(sentencObj, index){
            var searchIndex = searchUtils.parseSearchIndex(sentencesObjects[index].moreTextIndex);
            sentencObj.moreTextIndex = {
               start: searchIndex[0],
               len: searchIndex[1],
            };
            sentencObj.exactMatch = sentencesObjects[index].exactMatch;
            sentencObj.exactOrder = sentencesObjects[index].exactOrder;
            return sentencObj;
         });
         return sentences;
      }

      function createArabicSearchByEnWord(searchResults, arabicWordsDict, lang){
        var searchResult = [];
        _.each(arabicWordsDict, function(arabicWords, stem){
           var group = {
             forms : [],
             key: lang + '_' + stem,
             moreTextIndex: [],
             value : []
           };
           _.each(arabicWords, function(arabicWord) {
             var stem = languageUtils.stemmer(arabicWord, lang);
             var searchObj = _.findWhere(searchResults, {key: lang + '_' + stem});
             if (searchObj) {
              [].push.apply(group.forms, searchObj.forms);
              [].push.apply(group.moreTextIndex, searchObj.moreTextIndex);
              [].push.apply(group.value, searchObj.value);
             }
           });
           searchResult.push(group);
        });
        return searchResult;
      }
      /**
       * @param  {Array} searchWords
       * @param  {string} lang
       * @param  {Object} provider
       * @return {Object} searchResponse
       */
      function searchByGenerateArabicWords(searchWords, lang, provider){
         var phoneticWords = languageUtils.tokenizing(searchWords.join(' '), 'en');
         if (phoneticWords.length === 0) {
            return [];
         }

         var arabicWordsDict = generateArabicSearchStems(phoneticWords, lang);
         var arabicStems = getSearchArabicStems(arabicWordsDict, lang);
         var searchStems = createSearchArray(lang, arabicStems);
         return getWordObjects(searchStems, 'stem', provider)
            .then(function(phoneticResponse){
               if(phoneticResponse.length !== 0){
                  var searchResults = phoneticResponse.searchResults;
                  var newSearchResult = createArabicSearchByEnWord(searchResults, arabicWordsDict, lang);
                  return {
                     ipaIntersectPhoneme: newSearchResult
                  };
               }
               else {
                  return {
                     ipaIntersectPhoneme: []
                   };
               }
            });
      }

      /**
       * @param  {Array} phoneticWords
       * @param  {string} lang
       * @return {Array} stems
       */
      function generateArabicSearchStems(phoneticWords, lang) {
         if (phoneticWords.length === 0) {
            return [];
         }
         var arabicWordsDict = searchUtils.generateWord(phoneticWords, 'ar');
         return arabicWordsDict;
      }

      function getSearchArabicStems(arabicWords, lang) {
        var allForms = Array.prototype.concat.apply([], _.values(arabicWords));
        allForms = utils.uniqueElements(allForms);
        var stemsDict = {};
        _.each(allForms, function(word) {
           stemsDict[languageUtils.stemmer(word, lang)] = null;
        });
        var stems = _.keys(stemsDict);
        return stems;
      }

      function mergeSearchResult(searchResult) {
         var sentenceIndexObj = _.reduce(searchResult, function(sentenceIndexObj, sentenceIndex){
            // [].push.apply(sentenceIndexObj.forms, sentenceIndex.forms);
            sentenceIndexObj.forms.push(sentenceIndex.forms);
            sentenceIndexObj.sentenceIndexes.push(flatten(sentenceIndex.value));
            sentenceIndexObj.keys.push(sentenceIndex.key);
            sentenceIndexObj.value.push(sentenceIndex.value);
            sentenceIndexObj.moreTextIndex.push(sentenceIndex.moreTextIndex);
            return sentenceIndexObj;
         }, {
            forms: [],
            moreTextIndex: [],
            keys: [],
            value : [],
            sentenceIndexes: []
         });
         return sentenceIndexObj;
      }

      /**
       * @param  {string} language
       * @param  {Array} words
       * @return {Array} searchArray
       */
      function createSearchArray(language, words) {
         return _.map(words, function(word) {
            return language + '_' + word;
         });
      }

      /**
       * @param  {Array} searchArray consist of search index
       * @param  {string} filePrefix set type of search stem or phoneme
       * @param  {Object} provider perform access to search index
       * @return {Object} searchResponse
       */
      function getWordObjects(searchArray, filePrefix, provider) {
         if (searchArray.length === 0) {
            return q({
               searchResults: [],
               notFoundWords: []
            });
         }
         return provider.getWordDocument(searchArray, filePrefix);
      }

      /**
       * @param  {Array} notFoundWords
       * @param  {Number} maxLength
       * @return {Object} notFoundWords group by length
       */
      function groupedWordByLength(notFoundWords, maxLength) {
         return _.groupBy(notFoundWords, function(notFoundWord) {
            return languageUtils.tokenizing(notFoundWord, 'en').join('').length > maxLength ? 'soundEx' : 'ipa';
         });
      }

      /**
       * @param  {Array} words
       * @param  {string} lang
       * @return {Array} create phonetic searchArray
       */
      function createPhoneticCodes(words, lang){
         var phoneticWords = [];
         _.each(words, function(word){
            [].push.apply(phoneticWords, word.split('-'));
         });

         var phoneticCodes = _.map(phoneticWords, function (word) {
            word = languageUtils.replaceDiacritic(word, lang);
            return languageUtils.getPhoneme(word, lang);
         }).filter(Boolean);
         return phoneticCodes;
      }

      /**
       * @param  {Array} indexArray
       * @param  {string} bookId
       * @return {Array} filtredArray
       */
      function filterByBookId(indexArray, bookId, blackList) {
         var bookIdLen = bookId.length;
         var filtredArray = _.filter(indexArray, function(item){
            if (bookId) {
               return bookId === item.substr(0, bookIdLen);
            }
           return blackList.indexOf(item) === -1;
         });
         return filtredArray;
      }

      function getSortInfo(intersect, wordPositions, queryWord, lang) {
        if (queryWord.length === 0) {
          return {
            exactMatch: 0,
            exactOrder: 0
          };
        }
        var countExactMatch = 0;
        var exactMatch;
        var positions = [];
        _.each(wordPositions, function(position){
          var currentWord = intersect.forms[position.wordIndex][position.formIndex];
          var currentQueryWord = queryWord[position.wordIndex];
          var sentenceIndexe = intersect.value[position.wordIndex][position.formIndex][position.index].split(':');
          var locators = [sentenceIndexe[1]];
          if (sentenceIndexe[1].indexOf(',') !== -1) {
            [].push.apply(locators, sentenceIndexe[1].split(','));
          }
          _.each(locators, function(locator){
            var wordPosition = parseInt(locator.split('.')[0], 10);
            positions.push({
              wordPosition: wordPosition,
              queryWord: languageUtils.replaceDiacritic(currentQueryWord, lang)
            });
          });
          if (currentWord === currentQueryWord) {
            countExactMatch += 1;
          }
        });

        exactMatch = countExactMatch / wordPositions.length;
        
        positions = _.sortBy(positions, function(position){
           return position.wordPosition;
        });

        var exactOrderMatch = 0;
        var maxExactOrderMatch = 0;
        if (queryWord.length === 1) {
          maxExactOrderMatch = 1;
        }
        else {
          _.each(positions, function(position){
             var currentWord = languageUtils.replaceDiacritic(queryWord[exactOrderMatch] || '', lang);
             var previousWord = queryWord[exactOrderMatch - 1] || '';
             if (position.queryWord === currentWord) {
                exactOrderMatch += 1;
             }
             else if (position.queryWord !== previousWord){
                exactOrderMatch = 0;
             }

             if (maxExactOrderMatch < exactOrderMatch) {
                maxExactOrderMatch = exactOrderMatch;
             }
          });
          maxExactOrderMatch = (maxExactOrderMatch - 1) / (queryWord.length - 1);
        }
        return {
          exactMatch: exactMatch,
          exactOrder: maxExactOrderMatch
        };
      }

      function inBlackList(sentenceBlackList, sentenceIndex) {
        var i, len = sentenceBlackList.length;
        for(i = 0; i < len; i++) {
          if (sentenceBlackList[i] === sentenceIndex) {
            return true;
          }
        }
        return false;
      }
      /**
       * @param  {Array} intersect
       * @param  {Array} sentenceBlackList
       * @param  {string} bookId
       * @param  {object} queryParams
       * @return {object} intersectResponse intersect search result by search words
       */
      function arrayIntersect(intersect, sentenceBlackList, bookId, queryParams, lang) {

         var colonIndex, sentenceIndex,
            intersectResponse = {
               forms: [],
               sentenceIndexesObjects: [],
               sentenceIndexes: []
            },
            obj = {};

         _.each(intersect.value, function(wordSentenceIndexes, wordIndex){
            _.each(wordSentenceIndexes, function(wordFormSentenceIndexes, formIndex){
               _.each(wordFormSentenceIndexes, function(sentenceIndexes, index){
                  colonIndex = sentenceIndexes.indexOf(':');
                  sentenceIndex = sentenceIndexes.substring(0, colonIndex);
                  
                  if(wordIndex === 0) {
                    obj[sentenceIndex] = {
                       position: [{
                          wordIndex: wordIndex,
                          formIndex: formIndex,
                          index: index
                       }],
                       wordIndex: [wordIndex]
                    };
                  }
                  else if (obj.hasOwnProperty(sentenceIndex) && obj[sentenceIndex].wordIndex.length === wordIndex) {
                    obj[sentenceIndex].position.push({
                          wordIndex: wordIndex,
                          formIndex: formIndex,
                          index: index
                       });
                    if(obj[sentenceIndex].wordIndex.indexOf(wordIndex) === -1) {
                      obj[sentenceIndex].wordIndex.push(wordIndex);
                    }
                  }
               });
            });
         });

         _.each(obj, function(sentenceObj, sentenceIndex){
            if (sentenceObj.wordIndex.length === intersect.keys.length) {
              var underlineIndex = sentenceIndex.indexOf('_');
              var currentBookId = sentenceIndex.substring(0, underlineIndex);
              if ((bookId && currentBookId !== bookId) || inBlackList(sentenceBlackList, sentenceIndex) ) {
                 return;
              }

              var sortInfo = getSortInfo(intersect, obj[sentenceIndex].position, queryParams.queryWords, lang);
              var position = _.first(obj[sentenceIndex].position);
              intersectResponse.sentenceIndexesObjects.push({
                exactMatch: sortInfo.exactMatch,
                exactOrder: sortInfo.exactOrder,
                sentenceIndex: sentenceIndex,
                moreTextIndex: intersect.moreTextIndex[position.wordIndex][position.formIndex][position.index],
                bookId: currentBookId
              });
              intersectResponse.sentenceIndexes.push(sentenceIndex);
            }
         });
         intersectResponse.forms = intersect.forms;
         return intersectResponse;
      }

      /**
       * @param  {string} query is search query
       * @param  {string} lang current language in search query
       * @return {Array} phonemeWords Array consist of Strings which can be words for phonetic search
       */
      function getPhonemeWords(query, lang) {
         var phonemeWords = query.toLowerCase().split(/\s+/);
         phonemeWords = languageUtils.removeStopWord(phonemeWords, lang);
         phonemeWords = _.filter(phonemeWords, function (phoneme) {
            return phoneme.length > 1;
         });
         return phonemeWords;
      }

      /**
       * @param  {Array} items is Array of Objects
       * @param  {string} property is name of property what needed
       * @return {Array} items Array of Strings unique propertys
       */
      function getUniqParams(items, property) {
         return utils.uniqueElements(_.map(items, function (item) {
            return item[property];
         }));
      }
      /**
       * @param  {Array} sentencesArray is consist of sentence Objects
       * @param  {Array} quotes consist of Array of Strings quotes which parsed from search query
       * @param  {string} lang is current language in search query
       * @return {Array} sentencesArray is filtered sentencesArray by quotes
       */
      function filterSentenseByQuotes(sentencesArray, quotes, lang) {
         if (quotes && quotes.length === 0) {
            return sentencesArray;
         }

         var quotesWords = getQuoteWords(quotes, lang);
         var quoteReArr = _.map(quotesWords, function (quoteWords ,index) {
            var cleanQuote = languageUtils.replaceDiacritic(quoteWords.join(' '), lang);
            return searchUtils.getQuoteRe(cleanQuote, lang, 'i');
         });
         sentencesArray = _.filter(sentencesArray, function (sentencObj) {
            var normalizeSentence = languageUtils.replaceDiacritic(sentencObj.sentence, lang);
            var allQuotesInSentence = _.every(quotes, function (quote, index) {
               var quoteRe = quoteReArr[index];
               return quoteRe.test(normalizeSentence); //exact match
            });
            return allQuotesInSentence;
         });
         return sentencesArray;
      }

       /**
       * @param  {Array} quotes Array of Strings, found quotes in search query
       * @param  {string} lang current language in search query
       * @return {Array} quotes Array of Array consist of Strings
       */
      function getQuoteWords(quotes, lang) {
         //"exile in 1868"
         quotes = _.map(quotes, function (quote) {
            quote = quote.replace(/\s{2,}/g, ' ').split(' ');
            quote = _.map(quote, function (word) {
               if (searchUtils.isDigit(word)) {
                  return word;
               }
               else {
                  return languageUtils.tokenizing(word, lang);
               }
            });
            quote = _.flatten(quote);
            return quote;
         });
         return quotes;
      }

      /**
       * @param  {Array} forms is Array consist of Strings word forms
       * @param  {Array} targetWords is Array consist of Strings target words
       * @return {Array} forms is filtered forms by target words
       */
      function levenshteinFilter(forms, targetWords) {
         forms = _.filter(forms, function (word) {
            var approvedWords = _.filter(targetWords, function (targetWord) {
               var lev = _str.levenshtein(targetWord, word.normalized);
               return lev < Math.round(targetWord.length * 0.5);
            });
            return approvedWords.length === targetWords.length;
         });
         return forms;
      }
      /**
       * @param  {Array} sentences is Array consist of sentence Objects
       * @param  {Array} forms is Array consist of Strings word forms
       * @param  {Array} phoneticWords
       * @param  {string} lang is current language in search query
       * @return {Object} filtredObj
       */
      function phoneticFilter(sentences, forms, phoneticWords, lang) {
         var phoneticCodes = createPhoneticCodes(phoneticWords, lang);
         var standAloneWordRe = /<default>/;
         var wordsLevenshtein = _.map(forms, function (word) {
            return {
               original : word,
               normalized : languageUtils.replaceDiacritic(word, lang)
            };
         });

         var filteredForms = levenshteinFilter(wordsLevenshtein, phoneticWords, lang);
         if (filteredForms.length > 0) {
            forms = _.map(filteredForms, function(form){
               return form.original;
            });
         }

         if (forms.length !== 0) {
            standAloneWordRe = searchUtils.getWordsFormRe(forms, lang, 'i');
         }

         sentences = _.filter(sentences, function (sentencData) {
            return standAloneWordRe.test(sentencData.sentence);
         });
         return {
            filtredSentences: sentences,
            searchWords: phoneticCodes
         };
      }

      /**
       * @param  {Array} words
       * @param  {Array} cleanWord
       * @param  {string} lang
       * @return {Array} wordsWithDiacritic
       */
      function filteredWordsByDiacritic(words, cleanWord, lang) {
         return _.filter(words, function(word) {
            return cleanWord === languageUtils.replaceDiacritic(word, lang);
         });
      }

    /**
     * @param  {Array} sentencesArr
     * @param  {Array} stems
     * @param  {string} lang
     * @return {Array} filtredStems
     */
      function filterStemsBySentences(sentencesArr, stems, lang) {
         var stemReArr = _.map(stems, function(stem, index) {
            return searchUtils.getQuoteRe(stem, lang, 'i');
         });
         var filtredStems = _.filter(stems, function(stem, index) {
            var stemRe = stemReArr[index];
            var stemInsentences = _.some(sentencesArr, function(sentencObj, index) {
               return stemRe.test(sentencObj.sentence);
            });

            return stemInsentences;
         });
         return filtredStems;
      }

      /**
       * @param  {Array} nestedArray
       * @return {Array} flattenArray
       */
      function flatten(nestedArray){
         return Array.prototype.concat.apply([],nestedArray);
      }

      var renderSearch = function (query, params) {
         function highlightKeyWords(sentence, wordForms, quotes) {
            function getWordFormsRegexp(wordForms, quotesArray) {
               var boundaryCharacter = '[\'\\s\u2011-\u206F.,:;!?"(){}[\\]\\\\/|<>@#$%^&*=]';
               var nonBoundaryCharacter = boundaryCharacter[0] + '^' + boundaryCharacter.slice(1);
               var wordFormsAlternation = '',
                  quotes = '',
                  searchWordFroms = '';
               if (quotesArray.length !== 0) {
                  quotes = _.map(quotesArray, function (quote) {
                     quote = quote.join('(' + nonBoundaryCharacter + '+|' + boundaryCharacter + '+)');
                     return quote;
                  }).join('|');
                  searchWordFroms += quotes;
               }
               if (wordForms.length !== 0) {
                  wordFormsAlternation = _.map(wordForms, function (wordForm) {
                     return _str.escapeRegExp(wordForm);
                  }).join('|');
                  searchWordFroms += quotesArray.length !== 0 ? '|' + wordFormsAlternation : wordFormsAlternation;
               }

               return new RegExp(
                  '(?:^|' + nonBoundaryCharacter + '-|' + boundaryCharacter + ')' +
                  '(' + searchWordFroms + ')' +
                  '(?=$|-' + nonBoundaryCharacter + '|' + boundaryCharacter + ')', 'igm');
            }

            function highlightFunction(token) {
               return '<strong>' + token + '</strong>';
            }

            var wordFormsCapturingRegex = getWordFormsRegexp(wordForms, quotes);
            var highlightedSentence = sentence.replace(wordFormsCapturingRegex, function (match, p1) {
               return match === p1 ? highlightFunction(p1) : match.substr(0, match.length - p1.length) + highlightFunction(p1);
            });
            return highlightedSentence;
         }

         if (null === handlebarsTemplate) {
            handlebarsTemplate = fs.readFileSync(__dirname + '/searchResults.tpl');
            if (!handlebarsTemplate) {
               throw new Error('No template file!');
            }
            handlebarsTemplate = handlebars.compile(handlebarsTemplate.toString());
         }

         var deferred = q.defer();
         var templateData = {
            results : false,
            lang : {},
            params : {}
         };

         if (!params.page) {
            params.page = 0;
         }
         else {
            params.page = +params.page;
         }
         if(!params.clientID){
            params.clientID = 'ool';
         }
         params.bookId = '';
         templateData.lang[params.lang || 'en'] = true;
         var resultsPerPage = 10;
         var offset = resultsPerPage * params.page;
         templateData.params.page = params.page;
         templateData.params.lang = params.lang;
         templateData.params.clientID = params.clientID;
         templateData.params.q = query;
         templateData.somethingFound = true;

         if (params.page) {
            templateData.prevPage = {
               page : params.page - 1,
               params : templateData.params
            };
         }

         var procFunc = function () {
            //console.log(templateData)
            if (templateData.results.length) {
               templateData.nextPage = {
                  page : params.page + 1,
                  params : templateData.params
               };

            }
            templateData.hideResults = !templateData.results.length;
            if (!templateData.results.length && /^\s*\S/.test(query)) {
               templateData.somethingFound = false;
            }
            deferred.resolve(handlebarsTemplate(templateData));
         };
         search(query, params).then(function (data) {
            if (data.rows) {
               var res = 0,
                  pubI = 0,
                  pubs = [],
                  initialOffset = 0,
                  path = '';
               var promises = [];
               var addDataToResult = function (book) {
                  var pars = _.clone(params);
                  pars.bookId = book.bookId;
                  promises.push(search(query, pars));
               };
               while (pubI < data.rows.length) {
                  if (res <= offset && res + data.rows[pubI].totalResults > offset) {
                     if (res !== offset) {
                        initialOffset = offset - res;
                     }
                  }
                  else if (res > offset + resultsPerPage) {
                     break;
                  }
                  if (offset < res + data.rows[pubI].totalResults) {
                     if (data.rows[pubI].originalPath) {
                        for (var key in data.rows[pubI].originalPath) {
                           if (_.has(data.rows[pubI].originalPath, key)) {
                              path = data.rows[pubI].originalPath[key];
                              data.rows[pubI].originalPath[key] = {
                                 path : 'https://irls.isd.dp.ua/oceanoflights' + path
                              };
                           }
                        }
                     }
                     pubs.push(data.rows[pubI]);
                     addDataToResult(data.rows[pubI]);
                  }
                  res += data.rows[pubI].totalResults;
                  pubI++;
               }

               templateData.results = [];
               return q.all(promises).then(function (sents) {

                  for (var j = 0; j < sents.length; j++) {
                     if (sents[j].rows) {
                        for (var sentence = (j === 0 && initialOffset) ? initialOffset : 0; sentence < sents[j].rows.length; sentence++) {
                           var somedata = _.clone(pubs[j]);
                           somedata.sentence = highlightKeyWords(sents[j].rows[sentence].sentence, sents[j].stems, sents[j].quotes);
                           somedata.sentenceNumber = sents[j].rows[sentence].sentenceNumber;
                           templateData.results.push(somedata);
                           if (templateData.results.length === resultsPerPage) {
                              break;
                           }
                        }
                     }
                  }

               });
            }
            else {
               throw "Not found";
            }
         }).then(procFunc, procFunc);

         return deferred.promise;
      };

      /*function buildBooksBySentences(inters) {
       if (!inters.length) {
       return [
       [], []
       ];
       }
       var books = {}, sentences = [],
       key0 = inters[0].split('_')[0],
       i;
       for (i = 0; i < inters.length; i++) {
       var key = inters[i].split('_')[0];
       books[key] = (!books[key]) ? 1 : (books[key] + 1);

       if (key === key0) {
       sentences.push(inters[i]);
       }
       }
       var result = [];
       for (i in books) {
       if (books.hasOwnProperty(i)) {
       result.push({
       bookId : i,
       total_rows : books[i]
       });
       }
       }
       return [result, sentences];
       }*/

      return {
         search : search,
         getMoreText: getMoreText,
         render : renderSearch
      };
   };
})();
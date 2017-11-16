/*jshint unused: vars*/
/*jslint node: true */
(function () {
   'use strict';

   var fs = require('fs');
   var _ = require('underscore');
   var q = require('q');

   var searchUtils = require(__dirname + '/searchUtils');
   var utils = require('../utils/utils.js');
   var config = require('../utils/configReader.js');

   var provider = function (source) {

      this.getBooksMetaData = getBooksMetaData;
      this.getWordDocument = q.nbind(getWordDocument);
      this.getSentenceDocumentsByIndexes = q.nbind(getSentenceDocumentsByIndexes);
      this.getWordFormsByWord = getWordFormsByWord;
      this.validateQueryMeta = validateQueryMeta;
      this.readSentencesDocuments = q.nbind(readSentencesDocuments);

      var libraryDir = source;
      var globalWordIndex = {};

      var wordIndex = [];
      var bookIndex = [];
      var wordFormsCache = {};
      var dataSource = {
         initGlobalWordIndex : function(){
            var filePrefixs = ['phoneme', 'stem'];
            _.each(filePrefixs, function(filePrefix){
               var pathToWordIndex = libraryDir + 'wordindex_' + filePrefix + '.json';
               if (!globalWordIndex[filePrefix]) {
                  globalWordIndex[filePrefix] = JSON.parse(fs.readFileSync(pathToWordIndex));
               }
            });
         },
         getBookIndex : function(){
            if( bookIndex.length === 0) {
               bookIndex = JSON.parse(fs.readFileSync(libraryDir + 'books_final.json'));
            }
         },
         getPathToWordDocument: function(filePrefix){
            return libraryDir + 'words_' + filePrefix + '.json';
         },
         getPathToSentenceDocuments: function() {
           return libraryDir + 'sentences.json';
         }
      };

      /**
       * function for read json by binary offsets
       * @param  {number}   fd           file descriptore
       * @param  {array}    offsets      binary offsetes
       * @param  {number}   startIndex   offset current number 
       * @param  {array}    response     array of stringified json objects
       * @param  {Function} callback     function for return response
       */
      function readByRanges(fd, offsets, startIndex, response, callback) {
         var offset = offsets[startIndex];
         startIndex += 1;
         var buf = new Buffer(offset[1]);
         /**
          * offset[1] position
          * offset[0] length
         */
         fs.read(fd, buf, 0, offset[1], offset[0], function(err, bytesRead, buffer) {
            var data = {};
            if (err) {
               return callback(err, response);
            }
            else {
               data = buffer.toString('utf8');
            }

            response.push(data);
            if (offsets.length === startIndex) {
               return callback(err, response);
            }
            else {
               return readByRanges(fd, offsets, startIndex, response, callback);
            }
         });
      }

      /**
       * binaryReadObjectsByRanges function for read json object from file by binary offsets
       * @param  {string}   filename    file name 
       * @param  {array}    offsets     binady offsets [[position, length], ...]
       * @param  {Function} callback    function for return response
       */
      function binaryReadObjectsByRanges(filename, offsets, callback) {
         var result = [];
         if (offsets && offsets.length === 0) {
            return callback(null, result);
         }
         var fd = fs.openSync(filename, 'r');
         var response = [];
         var startIndex = 0;
         readByRanges(fd, offsets, startIndex,  response, function(err, response) {
            fs.close(fd);
            response = _.map(response, JSON.parse);
            if (err) {
               callback(utils.addSeverityResponse(err, config.businessFunctionStatus.error));
            }
            else {
               callback(err, response);
            }
         });
      }

      /**
       * function updateWordFormsCache for add new word in forms dict 
       * @param  {string} lang     language
       * @param  {string} word     word
       * @param  {array} wordForm word forms
       */
      function updateWordFormsCache(lang, word, wordForm) {
         var caheWord = lang + '_' + word;
         if (!wordFormsCache.hasOwnProperty(caheWord)) {
            wordFormsCache[caheWord] = {};
         }
         _.each(wordForm, function(form) {
            wordFormsCache[caheWord][form] = null;
         });
      }

      /**
       * function getWordDocument for read word documents 
       * @param  {array}   searchWords  string array consist of search words in format "lang_stem|phoneme"
       * @param  {string}   filePrefix  seatch type 'stem' or 'phoneme'
       * @param  {Function} callback    function for return results
       */
      function getWordDocument(searchWords, filePrefix, callback) {
         var filtredSearchWords = [],
            notFoundWords = [],
            searchResults = [];
         var res = {};
         var pathToWords = dataSource.getPathToWordDocument(filePrefix);
         dataSource.initGlobalWordIndex();

         wordIndex = globalWordIndex[filePrefix];

         _.each(searchWords, function(word){
            if (_.has(wordIndex, word)) {
               filtredSearchWords.push(wordIndex[word]);
            }
            else {
               notFoundWords.push(word.split('_')[1]);
            }
         });

         binaryReadObjectsByRanges(pathToWords, filtredSearchWords, function (err, wordObjects) {
               if (err) {
                  return callback(err, null);
               }
               wordObjects.forEach(function (obj) {
                  var word = obj[filePrefix];
                  searchResults.push({
                     key : obj.lang + '_' + word,
                     value : obj.sentenceIndexes,
                     moreTextIndex : obj.moreTextIndexes,
                     forms: obj.forms
                  });
                  updateWordFormsCache(obj.lang, word, obj.forms);
               });
               res = {
                  searchResults: searchResults,
                  notFoundWords: notFoundWords
               };
               callback(err, res);
            });
      }

      /**
       * function filterBookByMeta for filter books by search meta data
       * @param  {object} doc      book meta
       * @param  {object} metaData search meta data from query
       * @param  {string} lang     language
       */
      function filterBookByMeta(doc, metaData, lang) {
         var title = doc.meta && doc.meta.title ? doc.meta.title : '';
         var author = doc.meta && doc.meta.author ? doc.meta.author : '';
         var abbreviationTitle = doc.meta && doc.meta.abbreviationTitle ? doc.meta.abbreviationTitle : '';
         var abbreviationAuthor = doc.meta && doc.meta.abbreviationAuthor ? doc.meta.abbreviationAuthor : '';
         var collectionTitle = doc.meta && doc.meta.collectionTitle ? doc.meta.collectionTitle : '';

         title = searchUtils.replaceSigns(title, lang).toLowerCase();
         author = searchUtils.replaceSigns(author, lang).toLowerCase();

         abbreviationTitle = abbreviationTitle.toLowerCase();
         abbreviationAuthor = abbreviationAuthor.toLowerCase();
         collectionTitle = collectionTitle.toLowerCase();

         var books = _.filter(metaData, function (meta) {
            meta = searchUtils.replaceSigns(meta, lang).toLowerCase();

            var isAuthor = author.length !== 0 ? author.indexOf(meta) !== -1 : false;
            var isTitle = title.length !== 0 ? title.indexOf(meta) !== -1 : false;
            var isCollectionTitle = collectionTitle.length !== 0 ? collectionTitle.indexOf(meta) !== -1 : false;

            var isTitleAbbreviation = abbreviationTitle === meta;
            var isAuthorAbbreviation = abbreviationAuthor === meta;
            return isAuthor || isTitle || isAuthorAbbreviation || isTitleAbbreviation || isCollectionTitle;
         });
         return books;
      }

      /**
       * functio validateQueryMeta for check query meta in books meta for optimizing search
       * @param  {object} metaData search meta data from query
       * @param  {string} lang
       */
      function validateQueryMeta(metaData, lang) {
         if (metaData && metaData.length === 0) {
            return true;
         }
         dataSource.getBookIndex();
         var filredBooks = _.filter(bookIndex, function(doc){
            return filterBookByMeta(doc, metaData, lang).length !== 0;
         });
         return filredBooks.length !== 0;
      }

      /**
       * function getBooksMetaData create book meta data dict
       * @param  {array} bookIds from search results
       * @param  {object} metaData search meta data from query
       * @param  {string} lang
       */
      function getBooksMetaData(bookIds, metaData, lang) {
         var result = {};
         dataSource.getBookIndex();
         bookIds.forEach(function (bookId) {
            var books = [];
            var doc = _.findWhere(bookIndex, {
               bookId : bookId
            });
   
            books = filterBookByMeta(doc, metaData, lang);
            if (books.length !== 0 || metaData.length === 0) {
               result[bookId] = {
                  doc : doc,
                  id : bookId,
                  key : bookId
               };
               result[bookId].doc._id = bookId;
            }
         });
         return result;
      }
      
      /**
       * getWordFormsByWord
       * @param  {string} lang
       * @param  {string} word stem or phonetic code
       * @return {object}
       */
      function getWordFormsByWord(lang, word) {
         var caheWord = lang + '_' + word;
         if(_.has(wordFormsCache,caheWord)) {
            return wordFormsCache[caheWord];
         }
         return {};
      }

      /**
       * functio getSentenceDocumentsByIndexes 
       * @param  {array}   sentenceIndexes
       * @param  {Function} callback
       */
      function getSentenceDocumentsByIndexes(sentenceIndexes, callback) {
         dataSource.getBookIndex();
         var sentenceOffsets = _.map(sentenceIndexes, searchUtils.parseSearchIndex);

         var pathToSentences = dataSource.getPathToSentenceDocuments();

         binaryReadObjectsByRanges(pathToSentences, sentenceOffsets, function (err, sentenceDocuments) {
               if (err) {
                  return callback(err, null);
               }
               var res = sentenceDocuments.map(function (sent) {
                  return {
                     bookId : sent.bookId,
                     fileName : _.findWhere(bookIndex, {
                        bookId : sent.bookId
                     }).files[parseInt(sent.fileIndex)],
                     sentence : sent.text,
                     sentenceNumber : sent.locator,
                     paragraphs : sent.paragraphs
                  };
               });
               callback(err, res);
            });
      }

      /**
       * function readSentencesDocuments for read sentece document array
       * @param  {number} position
       * @param  {number} len
       */
      function readSentencesDocuments(position, len, callback) {
         var pathToSentences = dataSource.getPathToSentenceDocuments();

         var fd = fs.openSync(pathToSentences, 'r');
         var response = [];
         var startIndex = 0;

         readByRanges(fd, [[position, len]], startIndex, response, function(err, response) {
            fs.close(fd);
            if(err) {
               callback(err, null);
            }
            else {
               response = JSON.parse('[' + response[0] + ']');
               callback(err, response);
            }
         });
      }
   };


   module.exports = provider;
}());
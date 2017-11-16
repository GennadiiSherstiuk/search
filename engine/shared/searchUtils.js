define([
   './node_modules/lodash-3.9.3/lodash.js'
], function(_) {
   'use strict';

   var getQuotePart = function(query, quotesOpt) {
      //quotes „“«»“”‘’‹›"'
      var openQuotes = quotesOpt.openQuotes;
      var closeQuotes = quotesOpt.closeQuotes;
      var qouteRe = new RegExp('[' + openQuotes + '][^' + openQuotes + closeQuotes + ']*[' + closeQuotes + ']', 'gi');
      var quotes = query.match(qouteRe) || [];
      return quotes;
   };

   var getMetaData = function(query) {
      //(effendi,abd)
      var metaData = [];
      var letters = query.split('');
      var meta = '';
      var breckets = 0;
      _.each(letters, function(letter) {
         if (letter === '(') {
            breckets += 1;
         }
         if (letter === ')') {
            breckets -= 1;
         }
         if (breckets > 0) {
            meta += letter;
         }
         if (breckets === 0 && meta.length !== 0) {
            meta += letter;
            metaData.push(meta);
            meta = '';
         }
      });
      return metaData;
   };

   var getBlackListWords = function(query) {
      // -word1 -word2 or word1- word2-
      var blackList = _.without(query.split(' '), '', ' ');
      blackList = _.filter(blackList, function(notWord) {
         notWord = notWord.trim();
         return notWord[0] === '-' || notWord[notWord.length - 1] === '-';
      });
      return blackList;
   };

   var cleanQuery = function(parts, query) {
      _.each(parts, function(word) {
         query = query.replace(word, '');
      });
      return query;
   };

   function parseQuery(_query, options, lang) {
      var quotes,
         blackList,
         metaData,
         standAloneWords,
         quoteWrapRe,
         quoteRe,
         queryWords;

      var metaQueryParts = [];
      var query = _query.trim();
      quotes = getQuotePart(query, options.quotes, lang);
      query = cleanQuery(quotes, query);

      quoteWrapRe = new RegExp('(^[' + options.quotes.openQuotes + ']|[' + options.quotes.closeQuotes + ']$)', 'g');
      quoteRe = new RegExp('[' + options.quotes.openQuotes + options.quotes.closeQuotes + ']+', 'g');
      quotes = _.map(quotes, function(quote){
         quote = quote.replace(quoteWrapRe,'');
         return quote;
      });
      query = query.replace(quoteRe, '');

      metaData = getMetaData(query);
      query = cleanQuery(metaData, query);

      blackList = getBlackListWords(query, lang);
      query = cleanQuery(blackList, query);

      query = query.trim();

      if (metaData.length !== 0) {
         metaData = _.map(metaData[0].replace(/[\(\)]/g, '').split(','), function(meta) {
            return meta.trim();
         }).filter(function(meta) {
            return meta.length > 0;
         });
      }
      else {
         metaData = [];
      }
      standAloneWords = _.compact(query.split(/\s+/).map(function(word) {
         return word.trim();
      }));

      [].push.apply(metaQueryParts, blackList);
      [].push.apply(metaQueryParts, metaData);
      query = cleanQuery(metaQueryParts, _query);
      queryWords = query.split(/\s+/);
      return {
         quotes: quotes,
         blackList: blackList,
         metaData: metaData,
         standAloneWords: standAloneWords,
         queryWords: queryWords
      };
   }

   return {
      parseQuery: parseQuery
   };
});
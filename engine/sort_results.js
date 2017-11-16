/*jslint camelcase: false */
/*jslint node: true */
(function() {
   'use strict';
   var q          = require('q');
   var _          = require('underscore');
   
   var applicationSession = require('../rest/bl/applicationSessions');
   var userPublications   = require('../rest/userpublications.js');

   function getUserPublications(runId) {
      var deferred = q.defer();
      var ids = [];
      applicationSession.getUserId(runId)
      .then(function(userId){
         return userPublications.getRecentBooks(userId);
      })
      .then(function(recentBooks){
         ids = _.map(recentBooks.books, function(book){
            return book._id;
         });
         deferred.resolve(ids);
      })
      .fail(function(){
         deferred.resolve(ids);
      });
      return deferred.promise;
   }

   function _sortByRecentBook(recentBookIDs, searchResults) {
      var prevElements = [];
      recentBookIDs.forEach(function(id) {
         searchResults = searchResults.filter(function(el) {
            if (el._id === id) {
               prevElements.push(el);
            }
            return el._id !== id;
         });
      });
      return prevElements.concat(searchResults);
   }

   var _sortByProperty = function(sortedResult, property) {
     sortedResult = _.sortBy(sortedResult, function(book){
       return book[property];
     }).reverse();
     return sortedResult;
   };

   function sortBook(searchResults, runId, testFunc) {
      return getUserPublications(runId)
      .then(function(recentBookIDs) {
         var sortedResult = [],
             firstBook = [];

         if (recentBookIDs.length > 0) {
            sortedResult = _sortByRecentBook(recentBookIDs, searchResults);
         }
         else if(testFunc){
            _.each(searchResults, function(el){
               if(testFunc(el)){
                  firstBook.push(el);
               }
               else {
                  sortedResult.push(el);
               }
            });
         }
         else {
            sortedResult = searchResults;
         }

         if(sortedResult[0] && sortedResult[0]._id === recentBookIDs[0]){
            firstBook = sortedResult.splice(0,1);
         }
         sortedResult = _sortByProperty(sortedResult, 'relevant');

         if(firstBook.length === 1){
            sortedResult.unshift(firstBook[0]);
         }
         return sortedResult;
      });
   }

   function sortSentence(sentencesList){
      if(sentencesList.rows.length === 1){
         return sentencesList;
      }

      sentencesList.rows = _.sortBy(sentencesList.rows, function(sentenceData){
         return sentenceData.relevant * -1;
      });

      return sentencesList;
   }
 
   module.exports = {
      sortBook     : sortBook,
      sortSentence : sortSentence
   };
}());
/*jslint camelcase: false */
/*jslint node: true */
/* jshint -W100 */
"use strict";
var _         = require('underscore');
var unidecode = require('unidecode');
var _str      = require("underscore.string");
var XRegExp   = require('xregexp');

var config = require('../utils/configReader.js');
var logger = require('../utils/logger.js').getLogger(__filename);

var openQuotes  = config.searchConfig.quotes.openQuotes;
var closeQuotes = config.searchConfig.quotes.closeQuotes;

var digitsRe = /[\u06f0-\u06f9\u0660-\u0669\d]+/;

var isDigit = function(str){
  return digitsRe.test(str);
};

var getXRegExpLanguage = function(lang) {
   var langRe = config.searchConfig.languageInXRegExp[lang];
   if (!langRe) {
      logger.warn('Not found language "' + lang + '" in config, set default Latin');
   }
   return langRe || 'Latin';
};

var getQuotePartRe = function(quote) {
   var quoteRe = new XRegExp('[' + openQuotes + ']' + _str.escapeRegExp(quote) + '[' + closeQuotes + ']');
   return quoteRe;
};

var splitQuote = function(quote) {
   var tokenizeEnRe = /\s/;
   var words = _.without(quote.split(tokenizeEnRe), '', ' ');
   return words;
};

var getWordsFormRe = function(forms, lang, key) {
   var unicodeRange = getXRegExpLanguage(lang);
   return new XRegExp('(^|\\P{' + unicodeRange + '})' + forms.join('(\\P{' + unicodeRange + '}|$)|(^|\\P{' + unicodeRange + '})') + '(\\P{' + unicodeRange + '}|$)', key);
};

function generateWordsWithTegs(words) {
   var supportedTags = 'u';
   var re = '(?:</?' + supportedTags + '>)?';
   var wordFormsWithTegs = _.map(words, function(word) {
      return re + word.split('').join(re) + re;
   });
   return wordFormsWithTegs;
}

var getQuoteRe = function(quote, lang, key) {
   //"text text"
   var unicodeRange = getXRegExpLanguage(lang);
   var words = splitQuote(quote);
   words = _.map(words, function(word){
      return _str.escapeRegExp(word);
   });
   if(lang === 'en'){
     words = generateWordsWithTegs(words);
   }
   var quoteRe = '(^|\\P{' + unicodeRange + '})(' + words.join('\\P{' + unicodeRange + '}+') + ')(\\P{' + unicodeRange + '}+|$)';
   quoteRe = new XRegExp(quoteRe, key);
   return quoteRe;
};

var getWordRe = function(word, lang) {
   var unicodeRange = getXRegExpLanguage(lang);
   return new XRegExp('(^|\\P{' + unicodeRange + '})\\p{' + unicodeRange + '}*' + word + '\\p{' + unicodeRange + '}*(\\P{' + unicodeRange + '}|$)', 'i');
};

var replaceSigns = function(sentence, lang) {
   if (lang === 'en') {
      sentence = unidecode(sentence);
   }
   var re = new XRegExp('[^\\pL\\d\\s]+', 'ig');
   sentence = sentence.replace(re, '').replace(/\s/, '').trim();
   return sentence;
};

var soundExEn = function(s) {
   var a = s.toLowerCase().split(''),
   f = a.shift(),
   r = '',
   codes = {
      a : '', e : '', i : '', o : '', u : '',
      b : 1, f : 1, p : 1, v : 1, "w" : 1,
      c : 2, g : 2, j : 2, k : 2, q : 2, s : 2, x : 2, z : 2,
      d : 3, t : 3,
      l : 4,
      m : 5, n : 5,
      r : 6
   };

   r = f +
   a
      .map(function (v) {
         return codes[v];
      })
      .filter(function (v, i, a) {
         return ((i === 0) ? v !== codes[f] : v !== a[i - 1]);
      })
      .join('');

   return (r + '000').slice(0, 4).toUpperCase();
};

var soundExSimpleAr = function(s) {
    //http://research.ijcaonline.org/volume34/number10/pxc3876054.pdf
    var a = s.replace(/^[إآأا]/g, '').replace(/^[aeiouy']{1,}/g, '').split('');
    var r = '',
    codes = {
       'ف' : 1,'ب' : 1,
       'خ' : 2,'ج' : 2,'ز' : 2, 'س' : 2,'ص' : 2,'ظ' : 2,'ق' : 2,'ك' : 2,
       'ت' : 3,'ث' : 3,'د' : 3,'ذ' : 3,'ض' : 3, 'ط' : 3,
       'ل' : 4,
       'م' : 5,'ن' : 5,
       'ر' : 6,
       "b" : 1, "f" : 1, "p" : 1, "v" : 1, "w" : 1,
       "c" : 2, "g" : 2, "j" : 2, "k" : 2, "q" : 2, "s" : 2, "x" : 2, "z" : 2,
       "d" : 3, "t" : 3,
       "l" : 4,
       "m" : 5, "n" : 5,
       "r" : 6,
    };
    var previuseChar = '';
    a.forEach(function(character) {
      if (codes.hasOwnProperty(character) && (previuseChar.length === 0 || previuseChar !== codes[character])) {
        previuseChar = codes[character];
        r += codes[character];
      }
    });

    if(r.length !== 0){
      r = (r + '000').slice(0, 4);
    }
    return r;
};

var _getLetterCombinations = function(letters, phoneticDict) {
   var combination = [],
      grupedCombinations = [];
   var letterLen = letters.length,
      i, j;
   var word = '';
   for (j = 0; j < letterLen; j++) {
      combination = [];
      for (i = 2; i < letterLen; i++) {
         word = letters.slice(j, j + i).join('');
         if (word.length === i && _.has(phoneticDict.combination, word)) {
            combination = combination.concat(phoneticDict.combination[word]);
         }
      }
      grupedCombinations.push(combination);
   }
   return grupedCombinations;
};

var _createWords = function(letters) {
   var currentLetters = letters.splice(0, 1)[0];
   var nextleLetters = letters.splice(0, 1)[0];
   var words = [];
   _.each(currentLetters, function(currentLetter) {
      var lenCurrentLetters = currentLetter.length - 1;
      _.each(nextleLetters, function(nextleLetter) {
         if (currentLetter[lenCurrentLetters] === nextleLetter) {
            words.push(currentLetter);
         }
         words.push(currentLetter + nextleLetter);
      });
   });
   letters.unshift(words);
   if (letters.length !== 1) {
      return _createWords(letters);
   }
   else {
      return letters[0];
   }
};

var  phoneticDicts = {
   "ar" : {
  "a" : ["ا", "ة", ""],
  "b" : ["ب"],
  "c" : ["تش", "چ‎"],
  "d" : ["د", "ض", "ذ"],
  "e" : ["ا","ي","ـيه",'ع', ""],
  "f" : ["ف"],
  "g" : ["ج", "ق", "غ"],
  "h" : ["ه", "ح", "خ", ""],
  "i" : ["ي", ""],
  "j" : ["ج"],
  "k" : ["ك", "خ"],
  "l" : ["ل"],
  "m" : ["م"],
  "n" : ["ن"],
  "o" : ["و", ""],
  "p" : ["پ‎"],
  "q" : ["ق"],
  "r" : ["ر"],
  "s" : ["ث", "ش", "س", "ص"],
  "t" : ["ث","ت", "ة", "ط"],
  "u" : ["و", ""],
  "v" : ["و", "ڤ‎", "ڥ‎"],
  "w" : ["و", "ڤ‎", "ڥ‎"],
  "x" : [""],
  "y" : ["ي", ""],
  "z" : ["ذ", "ظ", "ز"],
  "ʻ" : ["ع"],
  "ʿ" : ["ع"],
  "‘" : ["ع"],
  "`" : ["ع"],
  "ʼ" : ["ء", "أ", "آ", "إ", "ئ", "ؤ"],
  "ʾ" : ["ء", "أ", "آ", "إ", "ئ", "ؤ"],
  "’" : ["ء", "أ", "آ", "إ", "ئ", "ؤ"],
  "\'" : ["ع", "ء", "أ", "آ", "إ", "ئ", "ؤ"],
  "combination" : {
    "dh"  : ["ذ"],
    "th"  : ["ث"],
    "sh"  : ["ش"],
    "ch"  : ["ش", "تش", "چ‎"],
    "kh"  : ["خ"],
    "gh"  : ["غ"],
    "tsh" : ["تش", "چ‎"],
    "ts"  : ["تش", "چ‎"],
    "tch" : ["تش", "چ‎"],
    "ei"  : ["ي","ـيه"],
    "ai"  : ["ي","ـيه"],
    "eh"  : ["ي","ـيه"],
    "eih" : ["ي","ـيه"],
    "aih" : ["ي","ـيه"],
    "ee"  : ["ي"],
    "ou"  : ["و"],
    "oo"  : ["و"]
      }
   }
};


function generateWord(words, lang) {
   var phoneticDict = {};
   var response = {};
   if (_.has(phoneticDicts, lang)) {
      phoneticDict = phoneticDicts[lang];
      _.each(words, function(word) {
         var wordForms = [];
         var checkedLetters = [];
         var letters = _.without(word.split(''), '');
         letters = _.filter(letters, function(letter){
            return _.has(phoneticDict, letter);
         });
         var grupedCombinations = _getLetterCombinations(letters, phoneticDict);
         letters = _.map(letters, function(letter, index) {
            var arabicLetters = phoneticDict[letter].concat(grupedCombinations[index]);
            return arabicLetters;
         }).filter(function(item) {
            return item.length !== 0;
         });
         checkedLetters = _.compact(Array.prototype.concat.apply([], letters));
         if (checkedLetters.length !== 0) {
            wordForms = _createWords(letters);
         }
         if (wordForms.length !== 0) {
            response[word] = wordForms;
         }
      });
   }
   return response;
}

function parseSearchIndex(el) {
  el = el.split('_');
  var indexPart = el[1].split(',');
  var start = parseInt(indexPart[0], 10);
  var len = parseInt(indexPart[1], 10);
  return [start, len];
}

module.exports = {
   getQuotePartRe          : getQuotePartRe,
   splitQuote              : splitQuote,
   getWordsFormRe          : getWordsFormRe,
   getQuoteRe              : getQuoteRe,
   getWordRe               : getWordRe,
   replaceSigns            : replaceSigns,
   soundExEn               : soundExEn,
   soundExAr               : soundExSimpleAr,
   generateWord            : generateWord,
   isDigit                 : isDigit,
   parseSearchIndex        : parseSearchIndex
};
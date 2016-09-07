'use strict'
module.exports = getFic
var Bluebird = require('bluebird')
var getChapter = require('./get-chapter.js')
var Readable = require('readable-stream').Readable
var inherits = require('util').inherits

function getFic (fetch, chapterList, maxConcurrency) {
  if (!maxConcurrency) maxConcurrency = 4
  var fic = new FicStream()
  Bluebird.map(chapterList, function (chapterInfo, ii) {
    return getChapter(fetch, chapterInfo.link).then(function (chapter) {
      chapter.name = chapterInfo.name
      return chapter
    }).catch(function (err) {
      console.error(err.message)
    })
  }, {concurrency: maxConcurrency}).each(function (chapter) {
    if (!chapter) return
    fic.queueChapter(chapter)
  }).then(function () {
    fic.queueChapter(null)
  })
  return fic
}

function FicStream (options) {
  if (!options) options = {}
  options.objectMode = true
  options.highWaterMark = 4
  Readable.call(this, options)
  this.FicStream = { reading: false, chapterBuffer: [], seen: {} }
}
inherits(FicStream, Readable)

FicStream.prototype.queueChapter = function (chapter) {
  if (chapter) {
    if (this.FicStream.seen[chapter.finalURL]) return
    this.FicStream.seen[chapter.finalURL] = true
  }
  if (this.FicStream.reading) {
    this.FicStream.reading = this.push(chapter)
  } else {
    this.FicStream.chapterBuffer.push(chapter)
  }
}

FicStream.prototype._read = function (size) {
  this.FicStream.reading = true
  while (this.FicStream.reading && this.FicStream.chapterBuffer.length) {
    var chapter = this.FicStream.chapterBuffer.shift()
    this.FicStream.reading = this.push(chapter)
  }
}

'use strict'
const qw = require('qw')
const Site = require('./site.js')

class Fic {
  constructor (fetch) {
    this.id = null
    this.fetch = fetch
    this.title = null
    this.link = null
    this.updateFrom = null
    this.author = null
    this.authorUrl = null
    this.created = null
    this.modified = null
    this.publisher = null
    this.description = null
    this.cover = null
    this.chapterHeadings = null
    this.externals = null
    this.words = null
    this.tags = []
    this.fics = []
    this.chapters = new ChapterList()
    this.site = null
    this.includeTOC = null
    this.numberTOC = null
  }

  chapterExists (link) {
    if (link == null) return false
    if (this.chapters.chapterExists(link, this)) return true
    if (this.fics.some(fic => fic.chapterExists(link))) return true
    return false
  }

  normalizeLink (link) {
    try {
      const site = Site.fromUrl(link)
      return site.normalizeLink(link)
    } catch (_) {
      return link
    }
  }

  getChapter (fetch, link) {
    const site = Site.fromUrl(link)
    return site.getChapter(fetch, link)
  }

  addChapter (opts) {
    if (this.chapterExists(opts.link) || this.chapterExists(opts.fetchFrom)) return
    this.chapters.addChapter(opts)
  }

  importFromJSON (raw) {
    for (let prop of qw`
         id link title author authorUrl created modified description tags
         publisher cover chapterHeadings words updateFrom includeTOC numberTOC
       `) {
      this[prop] = raw[prop]
    }
    this.chapters.importFromJSON(raw)
    if (raw.fics) {
      raw.fics.forEach(fic => this.fics.push(SubFic.fromJSON(this, fic)))
    }
    this.site = Site.fromUrl(this.link || this.updateFrom)
    this.externals = raw.externals != null ? raw.externals : true
    return this
  }

  static fromUrl (fetch, link) {
    const fic = new this(fetch)
    fic.site = Site.fromUrl(link)
    fic.link = fic.site.link
    return fic.site.getFicMetadata(fetch, fic).then(thenMaybeFallback, elseMaybeFallback).thenReturn(fic)
    function elseMaybeFallback (err) {
      if (err && (!err.meta || err.meta.status !== 404)) throw err
      return thenMaybeFallback()
    }
    function thenMaybeFallback () {
      // no chapters in the threadmarks, fallback to fetching
      if (fic.chapters.length === 0) {
        return fic.site.scrapeFicMetadata(fetch, fic)
      }
    }
  }

  static fromUrlAndScrape (fetch, link) {
    const fic = new this(fetch)
    fic.site = Site.fromUrl(link)
    fic.link = fic.site.link
    return fic.site.getFicMetadata(fetch, fic).then(() => {
      return fic.site.scrapeFicMetadata(fetch, fic).thenReturn(fic)
    })
  }

  static scrapeFromUrl (fetch, link) {
    const fic = new this()
    fic.site = Site.fromUrl(link)
    fic.link = fic.site.link
    return fic.site.scrapeFicMetadata(fetch, fic).thenReturn(fic)
  }

  static fromJSON (raw) {
    const fic = new this()
    return fic.importFromJSON(raw)
  }

  toJSON () {
    const result = {}
    for (let prop of qw`
         id title link updateFrom author authorUrl created modified publisher cover
         description tags words fics chapters chapterHeadings includeTOC numberTOC
       `) {
      if (this[prop] != null && (!Array.isArray(this[prop]) || this[prop].length)) result[prop] = this[prop]
    }
    if (!this.externals) result.externals = this.externals
    return result
  }
}

class SubFic extends Fic {
  constructor (parentFic) {
    super()
    delete this.fics
    this.parent = parentFic
  }
  chapterExists (link) {
    return this.chapters.chapterExists(link, this)
  }
  static fromJSON (parent, raw) {
    const fic = new this(parent)
    fic.importFromJSON(raw)
    return fic
  }
  get author () {
    return this._author || this.parent.author
  }
  set author (value) {
    return this._author = value
  }
  get authorUrl () {
    return this._authorUrl || this.parent.authorUrl
  }
  set authorUrl (value) {
    return this._authorUrl = value
  }
  get publisher () {
    return this._publisher || this.parent.publisher
  }
  set publisher (value) {
    return this._publisher = value
  }
  get link () {
    return this._link || this.parent.link
  }
  set link (value) {
    return this._link = value
  }
  get chapterHeadings () {
    return this._chapterHeadings || this.parent.chapterHeadings
  }
  set chapterHeadings (value) {
    return this._chapterHeadings = value
  }
  get externals () {
    return this._externals || this.parent.externals
  }
  set externals (value) {
    return this._externals = value
  }
  toJSON () {
    const result = {}
    for (let prop of qw`
         title _link _author _authorUrl created modified _publisher
         description tags chapters _chapterHeadings words includeTOC numberTOC
         `) {
      const assignTo = prop[0] === '_' ? prop.slice(1) : prop
      if (this[prop] && (this[prop].length == null || this[prop].length)) result[assignTo] = this[prop]
    }
    return result
  }
}

class ChapterList extends Array {
  chapterExists (link, fic) {
    if (link == null) {
      return
    } else if (fic) {
      return this.some(chap => fic.normalizeLink(chap.link) === fic.normalizeLink(link))
    } else {
      return this.some(chap => chap.link === link)
    }
  }
  addChapter (opts) {
    if (this.chapterExists(opts.fetchFrom) || this.chapterExists(opts.link)) return
    let name = opts.name
    let ctr = 0
    while (this.some(chap => chap.name === name)) {
      name = opts.name + ' (' + ++ctr + ')'
    }
    if (opts.created && (!this.created || opts.created < this.created)) this.created = opts.created
    this.push(new Chapter(Object.assign({}, opts, {name, order: this.length})))
  }
  importFromJSON (raw) {
    if (raw.fics && !raw.chapters) return
    if (!raw.chapters) {
      throw new Error('Fic "' + raw.title + '" is missing any chapters.')
    }
    raw.chapters.forEach(chapter => this.push(Chapter.fromJSON(this.length, chapter)))
  }
}

class Chapter {
  constructor (opts) {
    this.order = opts.order
    this.name = opts.name
    this.link = opts.link
    this.fetchFrom = opts.fetchFrom
    this.created = opts.created
    this.modified = opts.modified
    this.author = opts.author
    this.authorUrl = opts.authorUrl
    this.tags = opts.tags
    this.externals = opts.externals != null ? opts.externals : true
    this.headings = opts.headings
    this.words = opts.words
  }
  toJSON () {
    return {
      name: this.name,
      link: this.link,
      fetchFrom: this.fetchFrom,
      author: this.author,
      authorUrl: this.authorUrl,
      created: this.created,
      modified: this.modified,
      tags: this.tags,
      externals: this.externals !== true ? this.externals : null,
      headings: this.headings,
      words: this.words
    }
  }
  static fromJSON (order, opts) {
    return new Chapter(Object.assign({order}, opts))
  }
}

module.exports = Fic

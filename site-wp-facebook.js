'use strict'
const Site = require('./site.js')
const url = require('url')

class WpFacebook extends Site {
  static matches (siteUrlStr) {
    return /wp[.]com[/]graph[.]facebook[.]com/.test(siteUrlStr)
  }
  normalizeLink (link) {
    const linkBits = url.parse(link)
    linkBits.host = 'i0.wp.com'
    linkBits.pathname = linkBits.pathname.replace(/v2.2[/]/, '') + '/.jpg'
    return url.format(linkBits)
  }
  getChapter (fetch, chapter) {
    return Bluebird.resolve({
      meta: {},
      name: chapter,
      finalUrl: chapter,
      base: chapter,
      raw: '',
      content: '<img src="' + chapter + '">'
    })
  }
}
module.exports = WpFacebook

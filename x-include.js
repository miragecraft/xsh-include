// Cross-site HTML includes (v1.0) | github.com/miragecraft/x-include

'use strict';

const include = (()=>{

  let self = document.currentScript;
  // include directory, relative to this file
  let dir = self.getAttribute('data-dir');
  let path = dir ? link()(dir) + '/' : '';

  let f = (src,data) => {
    f.html(`<script src="${path}${src}" x>${data ? JSON.stringify(data) : ''}</script>`);
  }

  let log = [];
  let cache = new Map();

  let global_loop = self.hasAttribute('data-loop');
  let blockable = 'blocking' in document.createElement('link');

  f.html = (html)=>{

    let self = document.currentScript;

    if (typeof html === 'function') {

      let params = (()=>{
        let _p = {};
        return {
          get link() {
            return _p.link ??= link();
          },
          get data() {
            return _p.data ??= data();
          },
          get template() {
            return _p.template ??= template();
          }
        }
      })();

      html = html(params);
    }

    // DOM insertion allow <script> to trigger
    html = document.createRange().createContextualFragment(html);

    html.querySelectorAll('include-once').forEach((e)=>{
      let entry = e.getAttribute('id') ?? self.src;
      if (log.includes(entry)) {
        e.remove()
      } else {
        log.push(entry);
        e.replaceWith(...e.childNodes)
      }
    });

    let scripts = html.querySelectorAll('script');

    if (scripts.length) {

      let ancestry = new Set(self.getAttribute('data-injected')?.split(',') ?? []);
      if (!!self.src) ancestry.add(index(self.src));
      let ancestry_str = [...ancestry].join(',');
      let loop = global_loop || self.hasAttribute('data-loop');

      scripts.forEach((e)=>{
        if (ancestry.size) e.setAttribute('data-injected', ancestry_str);
        if (loop) e.setAttribute('data-loop', '');
        if (!e.src) return;
        if (!e.hasAttribute('async')) e.async = false;
        // if (e.hasAttribute('data-unique') && log.includes(e.src)) e.remove();
        if (!loop && ancestry.has(index(e.src))) {
          throw new Error('Infinite include loop terminated');
        }
      });
    }

    if (document.readyState === 'loading') {
      // preserve evaluation order via document.write
      scripts.forEach((e)=>{e.replaceWith(write(e))})
      // FOUC mitigation for external CSS
      let links = html.querySelectorAll('link[rel=stylesheet]');
      if (links.length) {
        // use "blocking" attribute (Chrome)
        if (blockable) {
          links.forEach((e)=>{
            e.setAttribute('blocking','render');
          });
        }
        // document.write fallback
        else if (!self.hasAttribute('data-injected')) {
          links.forEach((e)=>{
            e.replaceWith(write(e));
          })
        }
      }
    } else {
      // preserve evaluation order via include unwrapping
      if (cache.has(self)) {
        let combined = cache.get(self);
        combined.querySelector('x-include').replaceWith(html);
        html = combined;
        cache.delete(self); 
      }
      let target = html.querySelector('script[x]');
      if (!!target) {
        let marker = document.createElement('x-include');
        target.replaceWith(marker);
        cache.set(target, html);
        html = target;
      }
    }
    self.replaceWith(html);

    function write(e){
      let str = e.outerHTML.replace('</script>', '<\`+\`/script>');
      return document.createRange().createContextualFragment(`
        <script>
          document.write(\`${str}\`);
          document.currentScript.remove()
        </script>
      `)
    }

    function index(str) {
      let i = log.indexOf(str)+1;
      if (!i) i = log.push(str);
      return i.toString();
    }

    function data() {
      return JSON.parse(self.innerHTML)
      // allow parsing native JS object notation
      // new Function('return '+self.innerHTML.trim())()
    }

    function template() {
      let prev = self.previousElementSibling;
      if (!prev.matches('template')) {
        throw new Error('Missing <template> before the include <script>');
      }
      return prev.parentElement.removeChild(prev);
    }

  }

  function link() {

    let base = (document.currentScript.getAttribute('src') ?? '').trim();
    let prefix = '';

    if (base.includes('//')) {
      let split = 1+base.indexOf('/', 2+base.indexOf('//'));
      prefix = base.substring(0, split);
      base = base.substring(split);
    } else
    if (base.startsWith('/')) {
      prefix = '/';
      base = base.substring(1);
    } else
    if (base.startsWith('./')) {
      base = base.substring(2)
    } else
    if (base.startsWith('../')) {
      let split = 3+base.lastIndexOf('../');
      prefix = base.substring(0, split);
      base = base.substring(split); 
    }

    base = base.split('/');
    base.pop();

    return function(path) {

      if (!path) return;

      path = path.trim();

      if (
        path.includes('//') ||
        path.startsWith('/') ||
        path.startsWith('data:')
      ) {return path}

      if (path.startsWith('./')) {
        path = path.subString(2)
      }
      path = base.concat(path.split('/'));

      let total = path.indexOf('..');
      if (total>0) {
        let intent = path.lastIndexOf('..')-total+1;
        let actual = Math.min(total,intent);
        path.splice(total-actual,actual*2);
      }

      /* simpler but less efficient
      for (let i = path.indexOf('..'); i>0; i = path.indexOf('..')) {
        path.splice(i-1,2)
      }
      */

      path = prefix + path.join('/');

      if (path.indexOf('../') > 0) {
        throw new Error('Cannot resolve path');
      }

      return path
    }
  }

  return f;

})();
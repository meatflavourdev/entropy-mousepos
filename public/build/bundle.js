
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_custom_element_data(node, prop, value) {
        if (prop in node) {
            node[prop] = value;
        }
        else {
            attr(node, prop, value);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
     * Utility module to work with key-value stores.
     *
     * @module map
     */

    /**
     * Creates a new Map instance.
     *
     * @function
     * @return {Map<any, any>}
     *
     * @function
     */
    const create = () => new Map();

    /**
     * Copy a Map object into a fresh Map object.
     *
     * @function
     * @template X,Y
     * @param {Map<X,Y>} m
     * @return {Map<X,Y>}
     */
    const copy = m => {
      const r = create();
      m.forEach((v, k) => { r.set(k, v); });
      return r
    };

    /**
     * Get map property. Create T if property is undefined and set T on map.
     *
     * ```js
     * const listeners = map.setIfUndefined(events, 'eventName', set.create)
     * listeners.add(listener)
     * ```
     *
     * @function
     * @template T,K
     * @param {Map<K, T>} map
     * @param {K} key
     * @param {function():T} createT
     * @return {T}
     */
    const setIfUndefined = (map, key, createT) => {
      let set = map.get(key);
      if (set === undefined) {
        map.set(key, set = createT());
      }
      return set
    };

    /**
     * Creates an Array and populates it with the content of all key-value pairs using the `f(value, key)` function.
     *
     * @function
     * @template K
     * @template V
     * @template R
     * @param {Map<K,V>} m
     * @param {function(V,K):R} f
     * @return {Array<R>}
     */
    const map = (m, f) => {
      const res = [];
      for (const [key, value] of m) {
        res.push(f(value, key));
      }
      return res
    };

    /**
     * Tests whether any key-value pairs pass the test implemented by `f(value, key)`.
     *
     * @todo should rename to some - similarly to Array.some
     *
     * @function
     * @template K
     * @template V
     * @param {Map<K,V>} m
     * @param {function(V,K):boolean} f
     * @return {boolean}
     */
    const any = (m, f) => {
      for (const [key, value] of m) {
        if (f(value, key)) {
          return true
        }
      }
      return false
    };

    /**
     * Utility module to work with sets.
     *
     * @module set
     */

    const create$1 = () => new Set();

    /**
     * Utility module to work with Arrays.
     *
     * @module array
     */

    /**
     * Return the last element of an array. The element must exist
     *
     * @template L
     * @param {Array<L>} arr
     * @return {L}
     */
    const last = arr => arr[arr.length - 1];

    /**
     * Append elements from src to dest
     *
     * @template M
     * @param {Array<M>} dest
     * @param {Array<M>} src
     */
    const appendTo = (dest, src) => {
      for (let i = 0; i < src.length; i++) {
        dest.push(src[i]);
      }
    };

    /**
     * Transforms something array-like to an actual Array.
     *
     * @function
     * @template T
     * @param {ArrayLike<T>|Iterable<T>} arraylike
     * @return {T}
     */
    const from = Array.from;

    /**
     * Observable class prototype.
     *
     * @module observable
     */

    /**
     * Handles named events.
     *
     * @template N
     */
    class Observable {
      constructor () {
        /**
         * Some desc.
         * @type {Map<N, any>}
         */
        this._observers = create();
      }

      /**
       * @param {N} name
       * @param {function} f
       */
      on (name, f) {
        setIfUndefined(this._observers, name, create$1).add(f);
      }

      /**
       * @param {N} name
       * @param {function} f
       */
      once (name, f) {
        /**
         * @param  {...any} args
         */
        const _f = (...args) => {
          this.off(name, _f);
          f(...args);
        };
        this.on(name, _f);
      }

      /**
       * @param {N} name
       * @param {function} f
       */
      off (name, f) {
        const observers = this._observers.get(name);
        if (observers !== undefined) {
          observers.delete(f);
          if (observers.size === 0) {
            this._observers.delete(name);
          }
        }
      }

      /**
       * Emit a named event. All registered event listeners that listen to the
       * specified name will receive the event.
       *
       * @todo This should catch exceptions
       *
       * @param {N} name The event name.
       * @param {Array<any>} args The arguments that are applied to the event listener.
       */
      emit (name, args) {
        // copy all listeners to an array first to make sure that no event is emitted to listeners that are subscribed while the event handler is called.
        return from((this._observers.get(name) || create()).values()).forEach(f => f(...args))
      }

      destroy () {
        this._observers = create();
      }
    }

    /**
     * Common Math expressions.
     *
     * @module math
     */

    const floor = Math.floor;
    const abs = Math.abs;
    const log10 = Math.log10;

    /**
     * @function
     * @param {number} a
     * @param {number} b
     * @return {number} The smaller element of a and b
     */
    const min = (a, b) => a < b ? a : b;

    /**
     * @function
     * @param {number} a
     * @param {number} b
     * @return {number} The bigger element of a and b
     */
    const max = (a, b) => a > b ? a : b;

    /**
     * @param {number} n
     * @return {boolean} Wether n is negative. This function also differentiates between -0 and +0
     */
    const isNegativeZero = n => n !== 0 ? n < 0 : 1 / n < 0;

    /**
     * Utility module to work with strings.
     *
     * @module string
     */

    const fromCharCode = String.fromCharCode;

    /**
     * @param {string} s
     * @return {string}
     */
    const toLowerCase = s => s.toLowerCase();

    const trimLeftRegex = /^\s*/g;

    /**
     * @param {string} s
     * @return {string}
     */
    const trimLeft = s => s.replace(trimLeftRegex, '');

    const fromCamelCaseRegex = /([A-Z])/g;

    /**
     * @param {string} s
     * @param {string} separator
     * @return {string}
     */
    const fromCamelCase = (s, separator) => trimLeft(s.replace(fromCamelCaseRegex, match => `${separator}${toLowerCase(match)}`));

    /* istanbul ignore next */
    const utf8TextEncoder = /** @type {TextEncoder} */ (typeof TextEncoder !== 'undefined' ? new TextEncoder() : null);

    /* istanbul ignore next */
    let utf8TextDecoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

    /* istanbul ignore next */
    if (utf8TextDecoder && utf8TextDecoder.decode(new Uint8Array()).length === 1) {
      // Safari doesn't handle BOM correctly.
      // This fixes a bug in Safari 13.0.5 where it produces a BOM the first time it is called.
      // utf8TextDecoder.decode(new Uint8Array()).length === 1 on the first call and
      // utf8TextDecoder.decode(new Uint8Array()).length === 1 on the second call
      // Another issue is that from then on no BOM chars are recognized anymore
      /* istanbul ignore next */
      utf8TextDecoder = null;
    }

    /**
     * Often used conditions.
     *
     * @module conditions
     */

    /**
     * @template T
     * @param {T|null|undefined} v
     * @return {T|null}
     */
    /* istanbul ignore next */
    const undefinedToNull = v => v === undefined ? null : v;

    /* global localStorage */

    /**
     * Isomorphic variable storage.
     *
     * Uses LocalStorage in the browser and falls back to in-memory storage.
     *
     * @module storage
     */

    /* istanbul ignore next */
    class VarStoragePolyfill {
      constructor () {
        this.map = new Map();
      }

      /**
       * @param {string} key
       * @param {any} value
       */
      setItem (key, value) {
        this.map.set(key, value);
      }

      /**
       * @param {string} key
       */
      getItem (key) {
        return this.map.get(key)
      }
    }

    /* istanbul ignore next */
    /**
     * @type {any}
     */
    let _localStorage = new VarStoragePolyfill();

    try {
      // if the same-origin rule is violated, accessing localStorage might thrown an error
      /* istanbul ignore next */
      if (typeof localStorage !== 'undefined') {
        _localStorage = localStorage;
      }
    } catch (e) { }

    /* istanbul ignore next */
    /**
     * This is basically localStorage in browser, or a polyfill in nodejs
     */
    const varStorage = _localStorage;

    /**
     * Isomorphic module to work access the environment (query params, env variables).
     *
     * @module map
     */

    /* istanbul ignore next */
    // @ts-ignore
    const isNode = typeof process !== 'undefined' && process.release && /node|io\.js/.test(process.release.name);
    /* istanbul ignore next */
    const isBrowser = typeof window !== 'undefined' && !isNode;
    /* istanbul ignore next */
    const isMac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;

    /**
     * @type {Map<string,string>}
     */
    let params;

    /* istanbul ignore next */
    const computeParams = () => {
      if (params === undefined) {
        if (isNode) {
          params = create();
          const pargs = process.argv;
          let currParamName = null;
          /* istanbul ignore next */
          for (let i = 0; i < pargs.length; i++) {
            const parg = pargs[i];
            if (parg[0] === '-') {
              if (currParamName !== null) {
                params.set(currParamName, '');
              }
              currParamName = parg;
            } else {
              if (currParamName !== null) {
                params.set(currParamName, parg);
                currParamName = null;
              }
            }
          }
          if (currParamName !== null) {
            params.set(currParamName, '');
          }
        // in ReactNative for example this would not be true (unless connected to the Remote Debugger)
        } else if (typeof location === 'object') {
          params = create()
          // eslint-disable-next-line no-undef
          ;(location.search || '?').slice(1).split('&').forEach(kv => {
            if (kv.length !== 0) {
              const [key, value] = kv.split('=');
              params.set(`--${fromCamelCase(key, '-')}`, value);
              params.set(`-${fromCamelCase(key, '-')}`, value);
            }
          });
        } else {
          params = create();
        }
      }
      return params
    };

    /**
     * @param {string} name
     * @return {boolean}
     */
    /* istanbul ignore next */
    const hasParam = name => computeParams().has(name);
    // export const getArgs = name => computeParams() && args

    /**
     * @param {string} name
     * @return {string|null}
     */
    /* istanbul ignore next */
    const getVariable = name => isNode ? undefinedToNull(process.env[name.toUpperCase()]) : undefinedToNull(varStorage.getItem(name));

    /**
     * @param {string} name
     * @return {boolean}
     */
    /* istanbul ignore next */
    const hasConf = name => hasParam('--' + name) || getVariable(name) !== null;

    /* istanbul ignore next */
    const production = hasConf('production');

    /* eslint-env browser */

    /**
     * Binary data constants.
     *
     * @module binary
     */

    /**
     * n-th bit activated.
     *
     * @type {number}
     */
    const BIT1 = 1;
    const BIT2 = 2;
    const BIT3 = 4;
    const BIT4 = 8;
    const BIT6 = 32;
    const BIT7 = 64;
    const BIT8 = 128;
    const BITS5 = 31;
    const BITS6 = 63;
    const BITS7 = 127;
    /**
     * @type {number}
     */
    const BITS31 = 0x7FFFFFFF;

    /**
     * Efficient schema-less binary decoding with support for variable length encoding.
     *
     * Use [lib0/decoding] with [lib0/encoding]. Every encoding function has a corresponding decoding function.
     *
     * Encodes numbers in little-endian order (least to most significant byte order)
     * and is compatible with Golang's binary encoding (https://golang.org/pkg/encoding/binary/)
     * which is also used in Protocol Buffers.
     *
     * ```js
     * // encoding step
     * const encoder = new encoding.createEncoder()
     * encoding.writeVarUint(encoder, 256)
     * encoding.writeVarString(encoder, 'Hello world!')
     * const buf = encoding.toUint8Array(encoder)
     * ```
     *
     * ```js
     * // decoding step
     * const decoder = new decoding.createDecoder(buf)
     * decoding.readVarUint(decoder) // => 256
     * decoding.readVarString(decoder) // => 'Hello world!'
     * decoding.hasContent(decoder) // => false - all data is read
     * ```
     *
     * @module decoding
     */

    /**
     * A Decoder handles the decoding of an Uint8Array.
     */
    class Decoder {
      /**
       * @param {Uint8Array} uint8Array Binary data to decode
       */
      constructor (uint8Array) {
        /**
         * Decoding target.
         *
         * @type {Uint8Array}
         */
        this.arr = uint8Array;
        /**
         * Current decoding position.
         *
         * @type {number}
         */
        this.pos = 0;
      }
    }

    /**
     * @function
     * @param {Uint8Array} uint8Array
     * @return {Decoder}
     */
    const createDecoder = uint8Array => new Decoder(uint8Array);

    /**
     * @function
     * @param {Decoder} decoder
     * @return {boolean}
     */
    const hasContent = decoder => decoder.pos !== decoder.arr.length;

    /**
     * Create an Uint8Array view of the next `len` bytes and advance the position by `len`.
     *
     * Important: The Uint8Array still points to the underlying ArrayBuffer. Make sure to discard the result as soon as possible to prevent any memory leaks.
     *            Use `buffer.copyUint8Array` to copy the result into a new Uint8Array.
     *
     * @function
     * @param {Decoder} decoder The decoder instance
     * @param {number} len The length of bytes to read
     * @return {Uint8Array}
     */
    const readUint8Array = (decoder, len) => {
      const view = createUint8ArrayViewFromArrayBuffer(decoder.arr.buffer, decoder.pos + decoder.arr.byteOffset, len);
      decoder.pos += len;
      return view
    };

    /**
     * Read variable length Uint8Array.
     *
     * Important: The Uint8Array still points to the underlying ArrayBuffer. Make sure to discard the result as soon as possible to prevent any memory leaks.
     *            Use `buffer.copyUint8Array` to copy the result into a new Uint8Array.
     *
     * @function
     * @param {Decoder} decoder
     * @return {Uint8Array}
     */
    const readVarUint8Array = decoder => readUint8Array(decoder, readVarUint(decoder));

    /**
     * Read one byte as unsigned integer.
     * @function
     * @param {Decoder} decoder The decoder instance
     * @return {number} Unsigned 8-bit integer
     */
    const readUint8 = decoder => decoder.arr[decoder.pos++];

    /**
     * Read unsigned integer (32bit) with variable length.
     * 1/8th of the storage is used as encoding overhead.
     *  * numbers < 2^7 is stored in one bytlength
     *  * numbers < 2^14 is stored in two bylength
     *
     * @function
     * @param {Decoder} decoder
     * @return {number} An unsigned integer.length
     */
    const readVarUint = decoder => {
      let num = 0;
      let len = 0;
      while (true) {
        const r = decoder.arr[decoder.pos++];
        num = num | ((r & BITS7) << len);
        len += 7;
        if (r < BIT8) {
          return num >>> 0 // return unsigned number!
        }
        /* istanbul ignore if */
        if (len > 35) {
          throw new Error('Integer out of range!')
        }
      }
    };

    /**
     * Read signed integer (32bit) with variable length.
     * 1/8th of the storage is used as encoding overhead.
     *  * numbers < 2^7 is stored in one bytlength
     *  * numbers < 2^14 is stored in two bylength
     * @todo This should probably create the inverse ~num if unmber is negative - but this would be a breaking change.
     *
     * @function
     * @param {Decoder} decoder
     * @return {number} An unsigned integer.length
     */
    const readVarInt = decoder => {
      let r = decoder.arr[decoder.pos++];
      let num = r & BITS6;
      let len = 6;
      const sign = (r & BIT7) > 0 ? -1 : 1;
      if ((r & BIT8) === 0) {
        // don't continue reading
        return sign * num
      }
      while (true) {
        r = decoder.arr[decoder.pos++];
        num = num | ((r & BITS7) << len);
        len += 7;
        if (r < BIT8) {
          return sign * (num >>> 0)
        }
        /* istanbul ignore if */
        if (len > 41) {
          throw new Error('Integer out of range!')
        }
      }
    };

    /**
     * Read string of variable length
     * * varUint is used to store the length of the string
     *
     * Transforming utf8 to a string is pretty expensive. The code performs 10x better
     * when String.fromCodePoint is fed with all characters as arguments.
     * But most environments have a maximum number of arguments per functions.
     * For effiency reasons we apply a maximum of 10000 characters at once.
     *
     * @function
     * @param {Decoder} decoder
     * @return {String} The read String.
     */
    const readVarString = decoder => {
      let remainingLen = readVarUint(decoder);
      if (remainingLen === 0) {
        return ''
      } else {
        let encodedString = String.fromCodePoint(readUint8(decoder)); // remember to decrease remainingLen
        if (--remainingLen < 100) { // do not create a Uint8Array for small strings
          while (remainingLen--) {
            encodedString += String.fromCodePoint(readUint8(decoder));
          }
        } else {
          while (remainingLen > 0) {
            const nextLen = remainingLen < 10000 ? remainingLen : 10000;
            // this is dangerous, we create a fresh array view from the existing buffer
            const bytes = decoder.arr.subarray(decoder.pos, decoder.pos + nextLen);
            decoder.pos += nextLen;
            // Starting with ES5.1 we can supply a generic array-like object as arguments
            encodedString += String.fromCodePoint.apply(null, /** @type {any} */ (bytes));
            remainingLen -= nextLen;
          }
        }
        return decodeURIComponent(escape(encodedString))
      }
    };

    /**
     * @param {Decoder} decoder
     * @param {number} len
     * @return {DataView}
     */
    const readFromDataView = (decoder, len) => {
      const dv = new DataView(decoder.arr.buffer, decoder.arr.byteOffset + decoder.pos, len);
      decoder.pos += len;
      return dv
    };

    /**
     * @param {Decoder} decoder
     */
    const readFloat32 = decoder => readFromDataView(decoder, 4).getFloat32(0);

    /**
     * @param {Decoder} decoder
     */
    const readFloat64 = decoder => readFromDataView(decoder, 8).getFloat64(0);

    /**
     * @param {Decoder} decoder
     */
    const readBigInt64 = decoder => /** @type {any} */ (readFromDataView(decoder, 8)).getBigInt64(0);

    /**
     * @type {Array<function(Decoder):any>}
     */
    const readAnyLookupTable = [
      decoder => undefined, // CASE 127: undefined
      decoder => null, // CASE 126: null
      readVarInt, // CASE 125: integer
      readFloat32, // CASE 124: float32
      readFloat64, // CASE 123: float64
      readBigInt64, // CASE 122: bigint
      decoder => false, // CASE 121: boolean (false)
      decoder => true, // CASE 120: boolean (true)
      readVarString, // CASE 119: string
      decoder => { // CASE 118: object<string,any>
        const len = readVarUint(decoder);
        /**
         * @type {Object<string,any>}
         */
        const obj = {};
        for (let i = 0; i < len; i++) {
          const key = readVarString(decoder);
          obj[key] = readAny(decoder);
        }
        return obj
      },
      decoder => { // CASE 117: array<any>
        const len = readVarUint(decoder);
        const arr = [];
        for (let i = 0; i < len; i++) {
          arr.push(readAny(decoder));
        }
        return arr
      },
      readVarUint8Array // CASE 116: Uint8Array
    ];

    /**
     * @param {Decoder} decoder
     */
    const readAny = decoder => readAnyLookupTable[127 - readUint8(decoder)](decoder);

    /**
     * T must not be null.
     *
     * @template T
     */
    class RleDecoder extends Decoder {
      /**
       * @param {Uint8Array} uint8Array
       * @param {function(Decoder):T} reader
       */
      constructor (uint8Array, reader) {
        super(uint8Array);
        /**
         * The reader
         */
        this.reader = reader;
        /**
         * Current state
         * @type {T|null}
         */
        this.s = null;
        this.count = 0;
      }

      read () {
        if (this.count === 0) {
          this.s = this.reader(this);
          if (hasContent(this)) {
            this.count = readVarUint(this) + 1; // see encoder implementation for the reason why this is incremented
          } else {
            this.count = -1; // read the current value forever
          }
        }
        this.count--;
        return /** @type {T} */ (this.s)
      }
    }

    class UintOptRleDecoder extends Decoder {
      /**
       * @param {Uint8Array} uint8Array
       */
      constructor (uint8Array) {
        super(uint8Array);
        /**
         * @type {number}
         */
        this.s = 0;
        this.count = 0;
      }

      read () {
        if (this.count === 0) {
          this.s = readVarInt(this);
          // if the sign is negative, we read the count too, otherwise count is 1
          const isNegative = isNegativeZero(this.s);
          this.count = 1;
          if (isNegative) {
            this.s = -this.s;
            this.count = readVarUint(this) + 2;
          }
        }
        this.count--;
        return /** @type {number} */ (this.s)
      }
    }

    class IntDiffOptRleDecoder extends Decoder {
      /**
       * @param {Uint8Array} uint8Array
       */
      constructor (uint8Array) {
        super(uint8Array);
        /**
         * @type {number}
         */
        this.s = 0;
        this.count = 0;
        this.diff = 0;
      }

      /**
       * @return {number}
       */
      read () {
        if (this.count === 0) {
          const diff = readVarInt(this);
          // if the first bit is set, we read more data
          const hasCount = diff & 1;
          this.diff = diff >> 1;
          this.count = 1;
          if (hasCount) {
            this.count = readVarUint(this) + 2;
          }
        }
        this.s += this.diff;
        this.count--;
        return this.s
      }
    }

    class StringDecoder {
      /**
       * @param {Uint8Array} uint8Array
       */
      constructor (uint8Array) {
        this.decoder = new UintOptRleDecoder(uint8Array);
        this.str = readVarString(this.decoder);
        /**
         * @type {number}
         */
        this.spos = 0;
      }

      /**
       * @return {string}
       */
      read () {
        const end = this.spos + this.decoder.read();
        const res = this.str.slice(this.spos, end);
        this.spos = end;
        return res
      }
    }

    /**
     * Utility functions to work with buffers (Uint8Array).
     *
     * @module buffer
     */

    /**
     * @param {number} len
     */
    const createUint8ArrayFromLen = len => new Uint8Array(len);

    /**
     * Create Uint8Array with initial content from buffer
     *
     * @param {ArrayBuffer} buffer
     * @param {number} byteOffset
     * @param {number} length
     */
    const createUint8ArrayViewFromArrayBuffer = (buffer, byteOffset, length) => new Uint8Array(buffer, byteOffset, length);

    /**
     * Create Uint8Array with initial content from buffer
     *
     * @param {ArrayBuffer} buffer
     */
    const createUint8ArrayFromArrayBuffer = buffer => new Uint8Array(buffer);

    /* istanbul ignore next */
    /**
     * @param {Uint8Array} bytes
     * @return {string}
     */
    const toBase64Browser = bytes => {
      let s = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        s += fromCharCode(bytes[i]);
      }
      // eslint-disable-next-line no-undef
      return btoa(s)
    };

    /**
     * @param {Uint8Array} bytes
     * @return {string}
     */
    const toBase64Node = bytes => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');

    /* istanbul ignore next */
    /**
     * @param {string} s
     * @return {Uint8Array}
     */
    const fromBase64Browser = s => {
      // eslint-disable-next-line no-undef
      const a = atob(s);
      const bytes = createUint8ArrayFromLen(a.length);
      for (let i = 0; i < a.length; i++) {
        bytes[i] = a.charCodeAt(i);
      }
      return bytes
    };

    /**
     * @param {string} s
     */
    const fromBase64Node = s => {
      const buf = Buffer.from(s, 'base64');
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    };

    /* istanbul ignore next */
    const toBase64 = isBrowser ? toBase64Browser : toBase64Node;

    /* istanbul ignore next */
    const fromBase64 = isBrowser ? fromBase64Browser : fromBase64Node;

    /**
     * Copy the content of an Uint8Array view to a new ArrayBuffer.
     *
     * @param {Uint8Array} uint8Array
     * @return {Uint8Array}
     */
    const copyUint8Array = uint8Array => {
      const newBuf = createUint8ArrayFromLen(uint8Array.byteLength);
      newBuf.set(uint8Array);
      return newBuf
    };

    /**
     * Utility helpers for working with numbers.
     *
     * @module number
     */

    /**
     * @module number
     */

    /* istanbul ignore next */
    const isInteger = Number.isInteger || (num => typeof num === 'number' && isFinite(num) && floor(num) === num);

    /**
     * Efficient schema-less binary encoding with support for variable length encoding.
     *
     * Use [lib0/encoding] with [lib0/decoding]. Every encoding function has a corresponding decoding function.
     *
     * Encodes numbers in little-endian order (least to most significant byte order)
     * and is compatible with Golang's binary encoding (https://golang.org/pkg/encoding/binary/)
     * which is also used in Protocol Buffers.
     *
     * ```js
     * // encoding step
     * const encoder = new encoding.createEncoder()
     * encoding.writeVarUint(encoder, 256)
     * encoding.writeVarString(encoder, 'Hello world!')
     * const buf = encoding.toUint8Array(encoder)
     * ```
     *
     * ```js
     * // decoding step
     * const decoder = new decoding.createDecoder(buf)
     * decoding.readVarUint(decoder) // => 256
     * decoding.readVarString(decoder) // => 'Hello world!'
     * decoding.hasContent(decoder) // => false - all data is read
     * ```
     *
     * @module encoding
     */

    /**
     * A BinaryEncoder handles the encoding to an Uint8Array.
     */
    class Encoder {
      constructor () {
        this.cpos = 0;
        this.cbuf = new Uint8Array(100);
        /**
         * @type {Array<Uint8Array>}
         */
        this.bufs = [];
      }
    }

    /**
     * @function
     * @return {Encoder}
     */
    const createEncoder = () => new Encoder();

    /**
     * The current length of the encoded data.
     *
     * @function
     * @param {Encoder} encoder
     * @return {number}
     */
    const length = encoder => {
      let len = encoder.cpos;
      for (let i = 0; i < encoder.bufs.length; i++) {
        len += encoder.bufs[i].length;
      }
      return len
    };

    /**
     * Transform to Uint8Array.
     *
     * @function
     * @param {Encoder} encoder
     * @return {Uint8Array} The created ArrayBuffer.
     */
    const toUint8Array = encoder => {
      const uint8arr = new Uint8Array(length(encoder));
      let curPos = 0;
      for (let i = 0; i < encoder.bufs.length; i++) {
        const d = encoder.bufs[i];
        uint8arr.set(d, curPos);
        curPos += d.length;
      }
      uint8arr.set(createUint8ArrayViewFromArrayBuffer(encoder.cbuf.buffer, 0, encoder.cpos), curPos);
      return uint8arr
    };

    /**
     * Verify that it is possible to write `len` bytes wtihout checking. If
     * necessary, a new Buffer with the required length is attached.
     *
     * @param {Encoder} encoder
     * @param {number} len
     */
    const verifyLen = (encoder, len) => {
      const bufferLen = encoder.cbuf.length;
      if (bufferLen - encoder.cpos < len) {
        encoder.bufs.push(createUint8ArrayViewFromArrayBuffer(encoder.cbuf.buffer, 0, encoder.cpos));
        encoder.cbuf = new Uint8Array(max(bufferLen, len) * 2);
        encoder.cpos = 0;
      }
    };

    /**
     * Write one byte to the encoder.
     *
     * @function
     * @param {Encoder} encoder
     * @param {number} num The byte that is to be encoded.
     */
    const write = (encoder, num) => {
      const bufferLen = encoder.cbuf.length;
      if (encoder.cpos === bufferLen) {
        encoder.bufs.push(encoder.cbuf);
        encoder.cbuf = new Uint8Array(bufferLen * 2);
        encoder.cpos = 0;
      }
      encoder.cbuf[encoder.cpos++] = num;
    };

    /**
     * Write one byte as an unsigned integer.
     *
     * @function
     * @param {Encoder} encoder
     * @param {number} num The number that is to be encoded.
     */
    const writeUint8 = write;

    /**
     * Write a variable length unsigned integer.
     *
     * Encodes integers in the range from [0, 4294967295] / [0, 0xffffffff]. (max 32 bit unsigned integer)
     *
     * @function
     * @param {Encoder} encoder
     * @param {number} num The number that is to be encoded.
     */
    const writeVarUint = (encoder, num) => {
      while (num > BITS7) {
        write(encoder, BIT8 | (BITS7 & num));
        num >>>= 7;
      }
      write(encoder, BITS7 & num);
    };

    /**
     * Write a variable length integer.
     *
     * Encodes integers in the range from [-2147483648, -2147483647].
     *
     * We don't use zig-zag encoding because we want to keep the option open
     * to use the same function for BigInt and 53bit integers (doubles).
     *
     * We use the 7th bit instead for signaling that this is a negative number.
     *
     * @function
     * @param {Encoder} encoder
     * @param {number} num The number that is to be encoded.
     */
    const writeVarInt = (encoder, num) => {
      const isNegative = isNegativeZero(num);
      if (isNegative) {
        num = -num;
      }
      //             |- whether to continue reading         |- whether is negative     |- number
      write(encoder, (num > BITS6 ? BIT8 : 0) | (isNegative ? BIT7 : 0) | (BITS6 & num));
      num >>>= 6;
      // We don't need to consider the case of num === 0 so we can use a different
      // pattern here than above.
      while (num > 0) {
        write(encoder, (num > BITS7 ? BIT8 : 0) | (BITS7 & num));
        num >>>= 7;
      }
    };

    /**
     * Write a variable length string.
     *
     * @function
     * @param {Encoder} encoder
     * @param {String} str The string that is to be encoded.
     */
    const writeVarString = (encoder, str) => {
      const encodedString = unescape(encodeURIComponent(str));
      const len = encodedString.length;
      writeVarUint(encoder, len);
      for (let i = 0; i < len; i++) {
        write(encoder, /** @type {number} */ (encodedString.codePointAt(i)));
      }
    };

    /**
     * Append fixed-length Uint8Array to the encoder.
     *
     * @function
     * @param {Encoder} encoder
     * @param {Uint8Array} uint8Array
     */
    const writeUint8Array = (encoder, uint8Array) => {
      const bufferLen = encoder.cbuf.length;
      const cpos = encoder.cpos;
      const leftCopyLen = min(bufferLen - cpos, uint8Array.length);
      const rightCopyLen = uint8Array.length - leftCopyLen;
      encoder.cbuf.set(uint8Array.subarray(0, leftCopyLen), cpos);
      encoder.cpos += leftCopyLen;
      if (rightCopyLen > 0) {
        // Still something to write, write right half..
        // Append new buffer
        encoder.bufs.push(encoder.cbuf);
        // must have at least size of remaining buffer
        encoder.cbuf = new Uint8Array(max(bufferLen * 2, rightCopyLen));
        // copy array
        encoder.cbuf.set(uint8Array.subarray(leftCopyLen));
        encoder.cpos = rightCopyLen;
      }
    };

    /**
     * Append an Uint8Array to Encoder.
     *
     * @function
     * @param {Encoder} encoder
     * @param {Uint8Array} uint8Array
     */
    const writeVarUint8Array = (encoder, uint8Array) => {
      writeVarUint(encoder, uint8Array.byteLength);
      writeUint8Array(encoder, uint8Array);
    };

    /**
     * Create an DataView of the next `len` bytes. Use it to write data after
     * calling this function.
     *
     * ```js
     * // write float32 using DataView
     * const dv = writeOnDataView(encoder, 4)
     * dv.setFloat32(0, 1.1)
     * // read float32 using DataView
     * const dv = readFromDataView(encoder, 4)
     * dv.getFloat32(0) // => 1.100000023841858 (leaving it to the reader to find out why this is the correct result)
     * ```
     *
     * @param {Encoder} encoder
     * @param {number} len
     * @return {DataView}
     */
    const writeOnDataView = (encoder, len) => {
      verifyLen(encoder, len);
      const dview = new DataView(encoder.cbuf.buffer, encoder.cpos, len);
      encoder.cpos += len;
      return dview
    };

    /**
     * @param {Encoder} encoder
     * @param {number} num
     */
    const writeFloat32 = (encoder, num) => writeOnDataView(encoder, 4).setFloat32(0, num);

    /**
     * @param {Encoder} encoder
     * @param {number} num
     */
    const writeFloat64 = (encoder, num) => writeOnDataView(encoder, 8).setFloat64(0, num);

    /**
     * @param {Encoder} encoder
     * @param {bigint} num
     */
    const writeBigInt64 = (encoder, num) => /** @type {any} */ (writeOnDataView(encoder, 8)).setBigInt64(0, num);

    const floatTestBed = new DataView(new ArrayBuffer(4));
    /**
     * Check if a number can be encoded as a 32 bit float.
     *
     * @param {number} num
     * @return {boolean}
     */
    const isFloat32 = num => {
      floatTestBed.setFloat32(0, num);
      return floatTestBed.getFloat32(0) === num
    };

    /**
     * Encode data with efficient binary format.
     *
     * Differences to JSON:
     * • Transforms data to a binary format (not to a string)
     * • Encodes undefined, NaN, and ArrayBuffer (these can't be represented in JSON)
     * • Numbers are efficiently encoded either as a variable length integer, as a
     *   32 bit float, as a 64 bit float, or as a 64 bit bigint.
     *
     * Encoding table:
     *
     * | Data Type           | Prefix   | Encoding Method    | Comment |
     * | ------------------- | -------- | ------------------ | ------- |
     * | undefined           | 127      |                    | Functions, symbol, and everything that cannot be identified is encoded as undefined |
     * | null                | 126      |                    | |
     * | integer             | 125      | writeVarInt        | Only encodes 32 bit signed integers |
     * | float32             | 124      | writeFloat32       | |
     * | float64             | 123      | writeFloat64       | |
     * | bigint              | 122      | writeBigInt64      | |
     * | boolean (false)     | 121      |                    | True and false are different data types so we save the following byte |
     * | boolean (true)      | 120      |                    | - 0b01111000 so the last bit determines whether true or false |
     * | string              | 119      | writeVarString     | |
     * | object<string,any>  | 118      | custom             | Writes {length} then {length} key-value pairs |
     * | array<any>          | 117      | custom             | Writes {length} then {length} json values |
     * | Uint8Array          | 116      | writeVarUint8Array | We use Uint8Array for any kind of binary data |
     *
     * Reasons for the decreasing prefix:
     * We need the first bit for extendability (later we may want to encode the
     * prefix with writeVarUint). The remaining 7 bits are divided as follows:
     * [0-30]   the beginning of the data range is used for custom purposes
     *          (defined by the function that uses this library)
     * [31-127] the end of the data range is used for data encoding by
     *          lib0/encoding.js
     *
     * @param {Encoder} encoder
     * @param {undefined|null|number|bigint|boolean|string|Object<string,any>|Array<any>|Uint8Array} data
     */
    const writeAny = (encoder, data) => {
      switch (typeof data) {
        case 'string':
          // TYPE 119: STRING
          write(encoder, 119);
          writeVarString(encoder, data);
          break
        case 'number':
          if (isInteger(data) && data <= BITS31) {
            // TYPE 125: INTEGER
            write(encoder, 125);
            writeVarInt(encoder, data);
          } else if (isFloat32(data)) {
            // TYPE 124: FLOAT32
            write(encoder, 124);
            writeFloat32(encoder, data);
          } else {
            // TYPE 123: FLOAT64
            write(encoder, 123);
            writeFloat64(encoder, data);
          }
          break
        case 'bigint':
          // TYPE 122: BigInt
          write(encoder, 122);
          writeBigInt64(encoder, data);
          break
        case 'object':
          if (data === null) {
            // TYPE 126: null
            write(encoder, 126);
          } else if (data instanceof Array) {
            // TYPE 117: Array
            write(encoder, 117);
            writeVarUint(encoder, data.length);
            for (let i = 0; i < data.length; i++) {
              writeAny(encoder, data[i]);
            }
          } else if (data instanceof Uint8Array) {
            // TYPE 116: ArrayBuffer
            write(encoder, 116);
            writeVarUint8Array(encoder, data);
          } else {
            // TYPE 118: Object
            write(encoder, 118);
            const keys = Object.keys(data);
            writeVarUint(encoder, keys.length);
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              writeVarString(encoder, key);
              writeAny(encoder, data[key]);
            }
          }
          break
        case 'boolean':
          // TYPE 120/121: boolean (true/false)
          write(encoder, data ? 120 : 121);
          break
        default:
          // TYPE 127: undefined
          write(encoder, 127);
      }
    };

    /**
     * Now come a few stateful encoder that have their own classes.
     */

    /**
     * Basic Run Length Encoder - a basic compression implementation.
     *
     * Encodes [1,1,1,7] to [1,3,7,1] (3 times 1, 1 time 7). This encoder might do more harm than good if there are a lot of values that are not repeated.
     *
     * It was originally used for image compression. Cool .. article http://csbruce.com/cbm/transactor/pdfs/trans_v7_i06.pdf
     *
     * @note T must not be null!
     *
     * @template T
     */
    class RleEncoder extends Encoder {
      /**
       * @param {function(Encoder, T):void} writer
       */
      constructor (writer) {
        super();
        /**
         * The writer
         */
        this.w = writer;
        /**
         * Current state
         * @type {T|null}
         */
        this.s = null;
        this.count = 0;
      }

      /**
       * @param {T} v
       */
      write (v) {
        if (this.s === v) {
          this.count++;
        } else {
          if (this.count > 0) {
            // flush counter, unless this is the first value (count = 0)
            writeVarUint(this, this.count - 1); // since count is always > 0, we can decrement by one. non-standard encoding ftw
          }
          this.count = 1;
          // write first value
          this.w(this, v);
          this.s = v;
        }
      }
    }

    /**
     * @param {UintOptRleEncoder} encoder
     */
    const flushUintOptRleEncoder = encoder => {
      if (encoder.count > 0) {
        // flush counter, unless this is the first value (count = 0)
        // case 1: just a single value. set sign to positive
        // case 2: write several values. set sign to negative to indicate that there is a length coming
        writeVarInt(encoder.encoder, encoder.count === 1 ? encoder.s : -encoder.s);
        if (encoder.count > 1) {
          writeVarUint(encoder.encoder, encoder.count - 2); // since count is always > 1, we can decrement by one. non-standard encoding ftw
        }
      }
    };

    /**
     * Optimized Rle encoder that does not suffer from the mentioned problem of the basic Rle encoder.
     *
     * Internally uses VarInt encoder to write unsigned integers. If the input occurs multiple times, we write
     * write it as a negative number. The UintOptRleDecoder then understands that it needs to read a count.
     *
     * Encodes [1,2,3,3,3] as [1,2,-3,3] (once 1, once 2, three times 3)
     */
    class UintOptRleEncoder {
      constructor () {
        this.encoder = new Encoder();
        /**
         * @type {number}
         */
        this.s = 0;
        this.count = 0;
      }

      /**
       * @param {number} v
       */
      write (v) {
        if (this.s === v) {
          this.count++;
        } else {
          flushUintOptRleEncoder(this);
          this.count = 1;
          this.s = v;
        }
      }

      toUint8Array () {
        flushUintOptRleEncoder(this);
        return toUint8Array(this.encoder)
      }
    }

    /**
     * @param {IntDiffOptRleEncoder} encoder
     */
    const flushIntDiffOptRleEncoder = encoder => {
      if (encoder.count > 0) {
        //          31 bit making up the diff | wether to write the counter
        const encodedDiff = encoder.diff << 1 | (encoder.count === 1 ? 0 : 1);
        // flush counter, unless this is the first value (count = 0)
        // case 1: just a single value. set first bit to positive
        // case 2: write several values. set first bit to negative to indicate that there is a length coming
        writeVarInt(encoder.encoder, encodedDiff);
        if (encoder.count > 1) {
          writeVarUint(encoder.encoder, encoder.count - 2); // since count is always > 1, we can decrement by one. non-standard encoding ftw
        }
      }
    };

    /**
     * A combination of the IntDiffEncoder and the UintOptRleEncoder.
     *
     * The count approach is similar to the UintDiffOptRleEncoder, but instead of using the negative bitflag, it encodes
     * in the LSB whether a count is to be read. Therefore this Encoder only supports 31 bit integers!
     *
     * Encodes [1, 2, 3, 2] as [3, 1, 6, -1] (more specifically [(1 << 1) | 1, (3 << 0) | 0, -1])
     *
     * Internally uses variable length encoding. Contrary to normal UintVar encoding, the first byte contains:
     * * 1 bit that denotes whether the next value is a count (LSB)
     * * 1 bit that denotes whether this value is negative (MSB - 1)
     * * 1 bit that denotes whether to continue reading the variable length integer (MSB)
     *
     * Therefore, only five bits remain to encode diff ranges.
     *
     * Use this Encoder only when appropriate. In most cases, this is probably a bad idea.
     */
    class IntDiffOptRleEncoder {
      constructor () {
        this.encoder = new Encoder();
        /**
         * @type {number}
         */
        this.s = 0;
        this.count = 0;
        this.diff = 0;
      }

      /**
       * @param {number} v
       */
      write (v) {
        if (this.diff === v - this.s) {
          this.s = v;
          this.count++;
        } else {
          flushIntDiffOptRleEncoder(this);
          this.count = 1;
          this.diff = v - this.s;
          this.s = v;
        }
      }

      toUint8Array () {
        flushIntDiffOptRleEncoder(this);
        return toUint8Array(this.encoder)
      }
    }

    /**
     * Optimized String Encoder.
     *
     * Encoding many small strings in a simple Encoder is not very efficient. The function call to decode a string takes some time and creates references that must be eventually deleted.
     * In practice, when decoding several million small strings, the GC will kick in more and more often to collect orphaned string objects (or maybe there is another reason?).
     *
     * This string encoder solves the above problem. All strings are concatenated and written as a single string using a single encoding call.
     *
     * The lengths are encoded using a UintOptRleEncoder.
     */
    class StringEncoder {
      constructor () {
        /**
         * @type {Array<string>}
         */
        this.sarr = [];
        this.s = '';
        this.lensE = new UintOptRleEncoder();
      }

      /**
       * @param {string} string
       */
      write (string) {
        this.s += string;
        if (this.s.length > 19) {
          this.sarr.push(this.s);
          this.s = '';
        }
        this.lensE.write(string.length);
      }

      toUint8Array () {
        const encoder = new Encoder();
        this.sarr.push(this.s);
        this.s = '';
        writeVarString(encoder, this.sarr.join(''));
        writeUint8Array(encoder, this.lensE.toUint8Array());
        return toUint8Array(encoder)
      }
    }

    /* eslint-env browser */
    const perf = typeof performance === 'undefined' ? null : performance;

    const isoCrypto = typeof crypto === 'undefined' ? null : crypto;

    /**
     * @type {function(number):ArrayBuffer}
     */
    const cryptoRandomBuffer = isoCrypto !== null
      ? len => {
        // browser
        const buf = new ArrayBuffer(len);
        const arr = new Uint8Array(buf);
        isoCrypto.getRandomValues(arr);
        return buf
      }
      : len => {
        // polyfill
        const buf = new ArrayBuffer(len);
        const arr = new Uint8Array(buf);
        for (let i = 0; i < len; i++) {
          arr[i] = Math.ceil((Math.random() * 0xFFFFFFFF) >>> 0);
        }
        return buf
      };

    var performance_1 = perf;
    var cryptoRandomBuffer_1 = cryptoRandomBuffer;

    var isoBrowser = {
    	performance: performance_1,
    	cryptoRandomBuffer: cryptoRandomBuffer_1
    };

    /**
     * Isomorphic library exports from isomorphic.js.
     *
     * @module isomorphic
     */
    const cryptoRandomBuffer$1 = /** @type {any} */ (isoBrowser.cryptoRandomBuffer);

    /* istanbul ignore next */
    const uint32 = () => new Uint32Array(cryptoRandomBuffer$1(4))[0];

    // @ts-ignore
    const uuidv4Template = [1e7] + -1e3 + -4e3 + -8e3 + -1e11;
    const uuidv4 = () => uuidv4Template.replace(/[018]/g, /** @param {number} c */ c =>
      (c ^ uint32() & 15 >> c / 4).toString(16)
    );

    /**
     * Error helpers.
     *
     * @module error
     */

    /**
     * @param {string} s
     * @return {Error}
     */
    /* istanbul ignore next */
    const create$2 = s => new Error(s);

    /**
     * @throws {Error}
     * @return {never}
     */
    /* istanbul ignore next */
    const methodUnimplemented = () => {
      throw create$2('Method unimplemented')
    };

    /**
     * @throws {Error}
     * @return {never}
     */
    /* istanbul ignore next */
    const unexpectedCase = () => {
      throw create$2('Unexpected case')
    };

    /**
     * Utility functions for working with EcmaScript objects.
     *
     * @module object
     */

    /**
     * @param {Object<string,any>} obj
     */
    const keys = Object.keys;

    /**
     * @template R
     * @param {Object<string,any>} obj
     * @param {function(any,string):R} f
     * @return {Array<R>}
     */
    const map$1 = (obj, f) => {
      const results = [];
      for (const key in obj) {
        results.push(f(obj[key], key));
      }
      return results
    };

    /**
     * @param {Object<string,any>} obj
     * @return {number}
     */
    const length$1 = obj => keys(obj).length;

    /**
     * @param {Object<string,any>} obj
     * @param {function(any,string):boolean} f
     * @return {boolean}
     */
    const every = (obj, f) => {
      for (const key in obj) {
        if (!f(obj[key], key)) {
          return false
        }
      }
      return true
    };

    /**
     * Calls `Object.prototype.hasOwnProperty`.
     *
     * @param {any} obj
     * @param {string|symbol} key
     * @return {boolean}
     */
    const hasProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

    /**
     * @param {Object<string,any>} a
     * @param {Object<string,any>} b
     * @return {boolean}
     */
    const equalFlat = (a, b) => a === b || (length$1(a) === length$1(b) && every(a, (val, key) => (val !== undefined || hasProperty(b, key)) && b[key] === val));

    /**
     * Common functions and function call helpers.
     *
     * @module function
     */

    /**
     * Calls all functions in `fs` with args. Only throws after all functions were called.
     *
     * @param {Array<function>} fs
     * @param {Array<any>} args
     */
    const callAll = (fs, args, i = 0) => {
      try {
        for (; i < fs.length; i++) {
          fs[i](...args);
        }
      } finally {
        if (i < fs.length) {
          callAll(fs, args, i + 1);
        }
      }
    };

    /**
     * @template T
     *
     * @param {T} a
     * @param {T} b
     * @return {boolean}
     */
    const equalityStrict = (a, b) => a === b;

    /**
     * @param {any} a
     * @param {any} b
     * @return {boolean}
     */
    const equalityDeep = (a, b) => {
      if (a == null || b == null) {
        return equalityStrict(a, b)
      }
      if (a.constructor !== b.constructor) {
        return false
      }
      if (a === b) {
        return true
      }
      switch (a.constructor) {
        case ArrayBuffer:
          a = new Uint8Array(a);
          b = new Uint8Array(b);
        // eslint-disable-next-line no-fallthrough
        case Uint8Array: {
          if (a.byteLength !== b.byteLength) {
            return false
          }
          for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) {
              return false
            }
          }
          break
        }
        case Set: {
          if (a.size !== b.size) {
            return false
          }
          for (const value of a) {
            if (!b.has(value)) {
              return false
            }
          }
          break
        }
        case Map: {
          if (a.size !== b.size) {
            return false
          }
          for (const key of a.keys()) {
            if (!b.has(key) || !equalityDeep(a.get(key), b.get(key))) {
              return false
            }
          }
          break
        }
        case Object:
          if (length$1(a) !== length$1(b)) {
            return false
          }
          for (const key in a) {
            if (!hasProperty(a, key) || !equalityDeep(a[key], b[key])) {
              return false
            }
          }
          break
        case Array:
          if (a.length !== b.length) {
            return false
          }
          for (let i = 0; i < a.length; i++) {
            if (!equalityDeep(a[i], b[i])) {
              return false
            }
          }
          break
        default:
          return false
      }
      return true
    };

    /**
     * Utility module to work with EcmaScript Symbols.
     *
     * @module symbol
     */

    /**
     * Return fresh symbol.
     *
     * @return {Symbol}
     */
    const create$3 = Symbol;

    /**
     * Working with value pairs.
     *
     * @module pair
     */

    /**
     * @template L,R
     */
    class Pair {
      /**
       * @param {L} left
       * @param {R} right
       */
      constructor (left, right) {
        this.left = left;
        this.right = right;
      }
    }

    /**
     * @template L,R
     * @param {L} left
     * @param {R} right
     * @return {Pair<L,R>}
     */
    const create$4 = (left, right) => new Pair(left, right);

    /* eslint-env browser */

    /* istanbul ignore next */
    const domParser = /** @type {DOMParser} */ (typeof DOMParser !== 'undefined' ? new DOMParser() : null);

    /**
     * @param {Map<string,string>} m
     * @return {string}
     */
    /* istanbul ignore next */
    const mapToStyleString = m => map(m, (value, key) => `${key}:${value};`).join('');

    /**
     * Utility module to work with time.
     *
     * @module time
     */

    /**
     * Return current unix time.
     *
     * @return {number}
     */
    const getUnixTime = Date.now;

    /**
     * Isomorphic logging module with support for colors!
     *
     * @module logging
     */

    const BOLD = create$3();
    const UNBOLD = create$3();
    const BLUE = create$3();
    const GREY = create$3();
    const GREEN = create$3();
    const RED = create$3();
    const PURPLE = create$3();
    const ORANGE = create$3();
    const UNCOLOR = create$3();

    /**
     * @type {Object<Symbol,pair.Pair<string,string>>}
     */
    const _browserStyleMap = {
      [BOLD]: create$4('font-weight', 'bold'),
      [UNBOLD]: create$4('font-weight', 'normal'),
      [BLUE]: create$4('color', 'blue'),
      [GREEN]: create$4('color', 'green'),
      [GREY]: create$4('color', 'grey'),
      [RED]: create$4('color', 'red'),
      [PURPLE]: create$4('color', 'purple'),
      [ORANGE]: create$4('color', 'orange'), // not well supported in chrome when debugging node with inspector - TODO: deprecate
      [UNCOLOR]: create$4('color', 'black')
    };

    const _nodeStyleMap = {
      [BOLD]: '\u001b[1m',
      [UNBOLD]: '\u001b[2m',
      [BLUE]: '\x1b[34m',
      [GREEN]: '\x1b[32m',
      [GREY]: '\u001b[37m',
      [RED]: '\x1b[31m',
      [PURPLE]: '\x1b[35m',
      [ORANGE]: '\x1b[38;5;208m',
      [UNCOLOR]: '\x1b[0m'
    };

    /* istanbul ignore next */
    /**
     * @param {Array<string|Symbol|Object|number>} args
     * @return {Array<string|object|number>}
     */
    const computeBrowserLoggingArgs = args => {
      const strBuilder = [];
      const styles = [];
      const currentStyle = create();
      /**
       * @type {Array<string|Object|number>}
       */
      let logArgs = [];
      // try with formatting until we find something unsupported
      let i = 0;

      for (; i < args.length; i++) {
        const arg = args[i];
        // @ts-ignore
        const style = _browserStyleMap[arg];
        if (style !== undefined) {
          currentStyle.set(style.left, style.right);
        } else {
          if (arg.constructor === String || arg.constructor === Number) {
            const style = mapToStyleString(currentStyle);
            if (i > 0 || style.length > 0) {
              strBuilder.push('%c' + arg);
              styles.push(style);
            } else {
              strBuilder.push(arg);
            }
          } else {
            break
          }
        }
      }

      if (i > 0) {
        // create logArgs with what we have so far
        logArgs = styles;
        logArgs.unshift(strBuilder.join(''));
      }
      // append the rest
      for (; i < args.length; i++) {
        const arg = args[i];
        if (!(arg instanceof Symbol)) {
          logArgs.push(arg);
        }
      }
      return logArgs
    };

    /**
     * @param {Array<string|Symbol|Object|number>} args
     * @return {Array<string|object|number>}
     */
    const computeNodeLoggingArgs = args => {
      const strBuilder = [];
      const logArgs = [];

      // try with formatting until we find something unsupported
      let i = 0;

      for (; i < args.length; i++) {
        const arg = args[i];
        // @ts-ignore
        const style = _nodeStyleMap[arg];
        if (style !== undefined) {
          strBuilder.push(style);
        } else {
          if (arg.constructor === String || arg.constructor === Number) {
            strBuilder.push(arg);
          } else {
            break
          }
        }
      }
      if (i > 0) {
        // create logArgs with what we have so far
        strBuilder.push('\x1b[0m');
        logArgs.push(strBuilder.join(''));
      }
      // append the rest
      for (; i < args.length; i++) {
        const arg = args[i];
        /* istanbul ignore else */
        if (!(arg instanceof Symbol)) {
          logArgs.push(arg);
        }
      }
      return logArgs
    };

    /* istanbul ignore next */
    const computeLoggingArgs = isNode ? computeNodeLoggingArgs : computeBrowserLoggingArgs;

    /**
     * @param {Array<string|Symbol|Object|number>} args
     */
    const print = (...args) => {
      console.log(...computeLoggingArgs(args));
      /* istanbul ignore next */
      vconsoles.forEach(vc => vc.print(args));
    };

    const vconsoles = new Set();

    /**
     * Utility module to create and manipulate Iterators.
     *
     * @module iterator
     */

    /**
     * @template T
     * @param {function():IteratorResult<T>} next
     * @return {IterableIterator<T>}
     */
    const createIterator = next => ({
      /**
       * @return {IterableIterator<T>}
       */
      [Symbol.iterator] () {
        return this
      },
      // @ts-ignore
      next
    });

    /**
     * @template T
     * @param {Iterator<T>} iterator
     * @param {function(T):boolean} filter
     */
    const iteratorFilter = (iterator, filter) => createIterator(() => {
      let res;
      do {
        res = iterator.next();
      } while (!res.done && !filter(res.value))
      return res
    });

    /**
     * @template T,M
     * @param {Iterator<T>} iterator
     * @param {function(T):M} fmap
     */
    const iteratorMap = (iterator, fmap) => createIterator(() => {
      const { done, value } = iterator.next();
      return { done, value: done ? undefined : fmap(value) }
    });

    /**
     * This is an abstract interface that all Connectors should implement to keep them interchangeable.
     *
     * @note This interface is experimental and it is not advised to actually inherit this class.
     *       It just serves as typing information.
     *
     * @extends {Observable<any>}
     */
    class AbstractConnector extends Observable {
      /**
       * @param {Doc} ydoc
       * @param {any} awareness
       */
      constructor (ydoc, awareness) {
        super();
        this.doc = ydoc;
        this.awareness = awareness;
      }
    }

    class DeleteItem {
      /**
       * @param {number} clock
       * @param {number} len
       */
      constructor (clock, len) {
        /**
         * @type {number}
         */
        this.clock = clock;
        /**
         * @type {number}
         */
        this.len = len;
      }
    }

    /**
     * We no longer maintain a DeleteStore. DeleteSet is a temporary object that is created when needed.
     * - When created in a transaction, it must only be accessed after sorting, and merging
     *   - This DeleteSet is send to other clients
     * - We do not create a DeleteSet when we send a sync message. The DeleteSet message is created directly from StructStore
     * - We read a DeleteSet as part of a sync/update message. In this case the DeleteSet is already sorted and merged.
     */
    class DeleteSet {
      constructor () {
        /**
         * @type {Map<number,Array<DeleteItem>>}
         */
        this.clients = new Map();
      }
    }

    /**
     * Iterate over all structs that the DeleteSet gc's.
     *
     * @param {Transaction} transaction
     * @param {DeleteSet} ds
     * @param {function(GC|Item):void} f
     *
     * @function
     */
    const iterateDeletedStructs = (transaction, ds, f) =>
      ds.clients.forEach((deletes, clientid) => {
        const structs = /** @type {Array<GC|Item>} */ (transaction.doc.store.clients.get(clientid));
        for (let i = 0; i < deletes.length; i++) {
          const del = deletes[i];
          iterateStructs(transaction, structs, del.clock, del.len, f);
        }
      });

    /**
     * @param {Array<DeleteItem>} dis
     * @param {number} clock
     * @return {number|null}
     *
     * @private
     * @function
     */
    const findIndexDS = (dis, clock) => {
      let left = 0;
      let right = dis.length - 1;
      while (left <= right) {
        const midindex = floor((left + right) / 2);
        const mid = dis[midindex];
        const midclock = mid.clock;
        if (midclock <= clock) {
          if (clock < midclock + mid.len) {
            return midindex
          }
          left = midindex + 1;
        } else {
          right = midindex - 1;
        }
      }
      return null
    };

    /**
     * @param {DeleteSet} ds
     * @param {ID} id
     * @return {boolean}
     *
     * @private
     * @function
     */
    const isDeleted = (ds, id) => {
      const dis = ds.clients.get(id.client);
      return dis !== undefined && findIndexDS(dis, id.clock) !== null
    };

    /**
     * @param {DeleteSet} ds
     *
     * @private
     * @function
     */
    const sortAndMergeDeleteSet = ds => {
      ds.clients.forEach(dels => {
        dels.sort((a, b) => a.clock - b.clock);
        // merge items without filtering or splicing the array
        // i is the current pointer
        // j refers to the current insert position for the pointed item
        // try to merge dels[i] into dels[j-1] or set dels[j]=dels[i]
        let i, j;
        for (i = 1, j = 1; i < dels.length; i++) {
          const left = dels[j - 1];
          const right = dels[i];
          if (left.clock + left.len === right.clock) {
            left.len += right.len;
          } else {
            if (j < i) {
              dels[j] = right;
            }
            j++;
          }
        }
        dels.length = j;
      });
    };

    /**
     * @param {Array<DeleteSet>} dss
     * @return {DeleteSet} A fresh DeleteSet
     */
    const mergeDeleteSets = dss => {
      const merged = new DeleteSet();
      for (let dssI = 0; dssI < dss.length; dssI++) {
        dss[dssI].clients.forEach((delsLeft, client) => {
          if (!merged.clients.has(client)) {
            // Write all missing keys from current ds and all following.
            // If merged already contains `client` current ds has already been added.
            /**
             * @type {Array<DeleteItem>}
             */
            const dels = delsLeft.slice();
            for (let i = dssI + 1; i < dss.length; i++) {
              appendTo(dels, dss[i].clients.get(client) || []);
            }
            merged.clients.set(client, dels);
          }
        });
      }
      sortAndMergeDeleteSet(merged);
      return merged
    };

    /**
     * @param {DeleteSet} ds
     * @param {number} client
     * @param {number} clock
     * @param {number} length
     *
     * @private
     * @function
     */
    const addToDeleteSet = (ds, client, clock, length) => {
      setIfUndefined(ds.clients, client, () => []).push(new DeleteItem(clock, length));
    };

    const createDeleteSet = () => new DeleteSet();

    /**
     * @param {StructStore} ss
     * @return {DeleteSet} Merged and sorted DeleteSet
     *
     * @private
     * @function
     */
    const createDeleteSetFromStructStore = ss => {
      const ds = createDeleteSet();
      ss.clients.forEach((structs, client) => {
        /**
         * @type {Array<DeleteItem>}
         */
        const dsitems = [];
        for (let i = 0; i < structs.length; i++) {
          const struct = structs[i];
          if (struct.deleted) {
            const clock = struct.id.clock;
            let len = struct.length;
            if (i + 1 < structs.length) {
              for (let next = structs[i + 1]; i + 1 < structs.length && next.id.clock === clock + len && next.deleted; next = structs[++i + 1]) {
                len += next.length;
              }
            }
            dsitems.push(new DeleteItem(clock, len));
          }
        }
        if (dsitems.length > 0) {
          ds.clients.set(client, dsitems);
        }
      });
      return ds
    };

    /**
     * @param {AbstractDSEncoder} encoder
     * @param {DeleteSet} ds
     *
     * @private
     * @function
     */
    const writeDeleteSet = (encoder, ds) => {
      writeVarUint(encoder.restEncoder, ds.clients.size);
      ds.clients.forEach((dsitems, client) => {
        encoder.resetDsCurVal();
        writeVarUint(encoder.restEncoder, client);
        const len = dsitems.length;
        writeVarUint(encoder.restEncoder, len);
        for (let i = 0; i < len; i++) {
          const item = dsitems[i];
          encoder.writeDsClock(item.clock);
          encoder.writeDsLen(item.len);
        }
      });
    };

    /**
     * @param {AbstractDSDecoder} decoder
     * @return {DeleteSet}
     *
     * @private
     * @function
     */
    const readDeleteSet = decoder => {
      const ds = new DeleteSet();
      const numClients = readVarUint(decoder.restDecoder);
      for (let i = 0; i < numClients; i++) {
        decoder.resetDsCurVal();
        const client = readVarUint(decoder.restDecoder);
        const numberOfDeletes = readVarUint(decoder.restDecoder);
        if (numberOfDeletes > 0) {
          const dsField = setIfUndefined(ds.clients, client, () => []);
          for (let i = 0; i < numberOfDeletes; i++) {
            dsField.push(new DeleteItem(decoder.readDsClock(), decoder.readDsLen()));
          }
        }
      }
      return ds
    };

    /**
     * @todo YDecoder also contains references to String and other Decoders. Would make sense to exchange YDecoder.toUint8Array for YDecoder.DsToUint8Array()..
     */

    /**
     * @param {AbstractDSDecoder} decoder
     * @param {Transaction} transaction
     * @param {StructStore} store
     *
     * @private
     * @function
     */
    const readAndApplyDeleteSet = (decoder, transaction, store) => {
      const unappliedDS = new DeleteSet();
      const numClients = readVarUint(decoder.restDecoder);
      for (let i = 0; i < numClients; i++) {
        decoder.resetDsCurVal();
        const client = readVarUint(decoder.restDecoder);
        const numberOfDeletes = readVarUint(decoder.restDecoder);
        const structs = store.clients.get(client) || [];
        const state = getState(store, client);
        for (let i = 0; i < numberOfDeletes; i++) {
          const clock = decoder.readDsClock();
          const clockEnd = clock + decoder.readDsLen();
          if (clock < state) {
            if (state < clockEnd) {
              addToDeleteSet(unappliedDS, client, state, clockEnd - state);
            }
            let index = findIndexSS(structs, clock);
            /**
             * We can ignore the case of GC and Delete structs, because we are going to skip them
             * @type {Item}
             */
            // @ts-ignore
            let struct = structs[index];
            // split the first item if necessary
            if (!struct.deleted && struct.id.clock < clock) {
              structs.splice(index + 1, 0, splitItem(transaction, struct, clock - struct.id.clock));
              index++; // increase we now want to use the next struct
            }
            while (index < structs.length) {
              // @ts-ignore
              struct = structs[index++];
              if (struct.id.clock < clockEnd) {
                if (!struct.deleted) {
                  if (clockEnd < struct.id.clock + struct.length) {
                    structs.splice(index, 0, splitItem(transaction, struct, clockEnd - struct.id.clock));
                  }
                  struct.delete(transaction);
                }
              } else {
                break
              }
            }
          } else {
            addToDeleteSet(unappliedDS, client, clock, clockEnd - clock);
          }
        }
      }
      if (unappliedDS.clients.size > 0) {
        // TODO: no need for encoding+decoding ds anymore
        const unappliedDSEncoder = new DSEncoderV2();
        writeDeleteSet(unappliedDSEncoder, unappliedDS);
        store.pendingDeleteReaders.push(new DSDecoderV2(createDecoder((unappliedDSEncoder.toUint8Array()))));
      }
    };

    /**
     * @module Y
     */

    const generateNewClientId = uint32;

    /**
     * @typedef {Object} DocOpts
     * @property {boolean} [DocOpts.gc=true] Disable garbage collection (default: gc=true)
     * @property {function(Item):boolean} [DocOpts.gcFilter] Will be called before an Item is garbage collected. Return false to keep the Item.
     * @property {string} [DocOpts.guid] Define a globally unique identifier for this document
     * @property {any} [DocOpts.meta] Any kind of meta information you want to associate with this document. If this is a subdocument, remote peers will store the meta information as well.
     * @property {boolean} [DocOpts.autoLoad] If a subdocument, automatically load document. If this is a subdocument, remote peers will load the document as well automatically.
     */

    /**
     * A Yjs instance handles the state of shared data.
     * @extends Observable<string>
     */
    class Doc extends Observable {
      /**
       * @param {DocOpts} [opts] configuration
       */
      constructor ({ guid = uuidv4(), gc = true, gcFilter = () => true, meta = null, autoLoad = false } = {}) {
        super();
        this.gc = gc;
        this.gcFilter = gcFilter;
        this.clientID = generateNewClientId();
        this.guid = guid;
        /**
         * @type {Map<string, AbstractType<YEvent>>}
         */
        this.share = new Map();
        this.store = new StructStore();
        /**
         * @type {Transaction | null}
         */
        this._transaction = null;
        /**
         * @type {Array<Transaction>}
         */
        this._transactionCleanups = [];
        /**
         * @type {Set<Doc>}
         */
        this.subdocs = new Set();
        /**
         * If this document is a subdocument - a document integrated into another document - then _item is defined.
         * @type {Item?}
         */
        this._item = null;
        this.shouldLoad = autoLoad;
        this.autoLoad = autoLoad;
        this.meta = meta;
      }

      /**
       * Notify the parent document that you request to load data into this subdocument (if it is a subdocument).
       *
       * `load()` might be used in the future to request any provider to load the most current data.
       *
       * It is safe to call `load()` multiple times.
       */
      load () {
        const item = this._item;
        if (item !== null && !this.shouldLoad) {
          transact(/** @type {any} */ (item.parent).doc, transaction => {
            transaction.subdocsLoaded.add(this);
          }, null, true);
        }
        this.shouldLoad = true;
      }

      getSubdocs () {
        return this.subdocs
      }

      getSubdocGuids () {
        return new Set(Array.from(this.subdocs).map(doc => doc.guid))
      }

      /**
       * Changes that happen inside of a transaction are bundled. This means that
       * the observer fires _after_ the transaction is finished and that all changes
       * that happened inside of the transaction are sent as one message to the
       * other peers.
       *
       * @param {function(Transaction):void} f The function that should be executed as a transaction
       * @param {any} [origin] Origin of who started the transaction. Will be stored on transaction.origin
       *
       * @public
       */
      transact (f, origin = null) {
        transact(this, f, origin);
      }

      /**
       * Define a shared data type.
       *
       * Multiple calls of `y.get(name, TypeConstructor)` yield the same result
       * and do not overwrite each other. I.e.
       * `y.define(name, Y.Array) === y.define(name, Y.Array)`
       *
       * After this method is called, the type is also available on `y.share.get(name)`.
       *
       * *Best Practices:*
       * Define all types right after the Yjs instance is created and store them in a separate object.
       * Also use the typed methods `getText(name)`, `getArray(name)`, ..
       *
       * @example
       *   const y = new Y(..)
       *   const appState = {
       *     document: y.getText('document')
       *     comments: y.getArray('comments')
       *   }
       *
       * @param {string} name
       * @param {Function} TypeConstructor The constructor of the type definition. E.g. Y.Text, Y.Array, Y.Map, ...
       * @return {AbstractType<any>} The created type. Constructed with TypeConstructor
       *
       * @public
       */
      get (name, TypeConstructor = AbstractType) {
        const type = setIfUndefined(this.share, name, () => {
          // @ts-ignore
          const t = new TypeConstructor();
          t._integrate(this, null);
          return t
        });
        const Constr = type.constructor;
        if (TypeConstructor !== AbstractType && Constr !== TypeConstructor) {
          if (Constr === AbstractType) {
            // @ts-ignore
            const t = new TypeConstructor();
            t._map = type._map;
            type._map.forEach(/** @param {Item?} n */ n => {
              for (; n !== null; n = n.left) {
                // @ts-ignore
                n.parent = t;
              }
            });
            t._start = type._start;
            for (let n = t._start; n !== null; n = n.right) {
              n.parent = t;
            }
            t._length = type._length;
            this.share.set(name, t);
            t._integrate(this, null);
            return t
          } else {
            throw new Error(`Type with the name ${name} has already been defined with a different constructor`)
          }
        }
        return type
      }

      /**
       * @template T
       * @param {string} [name]
       * @return {YArray<T>}
       *
       * @public
       */
      getArray (name = '') {
        // @ts-ignore
        return this.get(name, YArray)
      }

      /**
       * @param {string} [name]
       * @return {YText}
       *
       * @public
       */
      getText (name = '') {
        // @ts-ignore
        return this.get(name, YText)
      }

      /**
       * @param {string} [name]
       * @return {YMap<any>}
       *
       * @public
       */
      getMap (name = '') {
        // @ts-ignore
        return this.get(name, YMap)
      }

      /**
       * @param {string} [name]
       * @return {YXmlFragment}
       *
       * @public
       */
      getXmlFragment (name = '') {
        // @ts-ignore
        return this.get(name, YXmlFragment)
      }

      /**
       * Converts the entire document into a js object, recursively traversing each yjs type
       *
       * @return {Object<string, any>}
       */
      toJSON () {
        /**
         * @type {Object<string, any>}
         */
        const doc = {};

        this.share.forEach((value, key) => {
          doc[key] = value.toJSON();
        });

        return doc
      }

      /**
       * Emit `destroy` event and unregister all event handlers.
       */
      destroy () {
        from(this.subdocs).forEach(subdoc => subdoc.destroy());
        const item = this._item;
        if (item !== null) {
          this._item = null;
          const content = /** @type {ContentDoc} */ (item.content);
          if (item.deleted) {
            // @ts-ignore
            content.doc = null;
          } else {
            content.doc = new Doc({ guid: this.guid, ...content.opts });
            content.doc._item = item;
          }
          transact(/** @type {any} */ (item).parent.doc, transaction => {
            if (!item.deleted) {
              transaction.subdocsAdded.add(content.doc);
            }
            transaction.subdocsRemoved.add(this);
          }, null, true);
        }
        this.emit('destroyed', [true]);
        super.destroy();
      }

      /**
       * @param {string} eventName
       * @param {function(...any):any} f
       */
      on (eventName, f) {
        super.on(eventName, f);
      }

      /**
       * @param {string} eventName
       * @param {function} f
       */
      off (eventName, f) {
        super.off(eventName, f);
      }
    }

    class DSDecoderV1 {
      /**
       * @param {decoding.Decoder} decoder
       */
      constructor (decoder) {
        this.restDecoder = decoder;
      }

      resetDsCurVal () {
        // nop
      }

      /**
       * @return {number}
       */
      readDsClock () {
        return readVarUint(this.restDecoder)
      }

      /**
       * @return {number}
       */
      readDsLen () {
        return readVarUint(this.restDecoder)
      }
    }

    class UpdateDecoderV1 extends DSDecoderV1 {
      /**
       * @return {ID}
       */
      readLeftID () {
        return createID(readVarUint(this.restDecoder), readVarUint(this.restDecoder))
      }

      /**
       * @return {ID}
       */
      readRightID () {
        return createID(readVarUint(this.restDecoder), readVarUint(this.restDecoder))
      }

      /**
       * Read the next client id.
       * Use this in favor of readID whenever possible to reduce the number of objects created.
       */
      readClient () {
        return readVarUint(this.restDecoder)
      }

      /**
       * @return {number} info An unsigned 8-bit integer
       */
      readInfo () {
        return readUint8(this.restDecoder)
      }

      /**
       * @return {string}
       */
      readString () {
        return readVarString(this.restDecoder)
      }

      /**
       * @return {boolean} isKey
       */
      readParentInfo () {
        return readVarUint(this.restDecoder) === 1
      }

      /**
       * @return {number} info An unsigned 8-bit integer
       */
      readTypeRef () {
        return readVarUint(this.restDecoder)
      }

      /**
       * Write len of a struct - well suited for Opt RLE encoder.
       *
       * @return {number} len
       */
      readLen () {
        return readVarUint(this.restDecoder)
      }

      /**
       * @return {any}
       */
      readAny () {
        return readAny(this.restDecoder)
      }

      /**
       * @return {Uint8Array}
       */
      readBuf () {
        return copyUint8Array(readVarUint8Array(this.restDecoder))
      }

      /**
       * Legacy implementation uses JSON parse. We use any-decoding in v2.
       *
       * @return {any}
       */
      readJSON () {
        return JSON.parse(readVarString(this.restDecoder))
      }

      /**
       * @return {string}
       */
      readKey () {
        return readVarString(this.restDecoder)
      }
    }

    class DSDecoderV2 {
      /**
       * @param {decoding.Decoder} decoder
       */
      constructor (decoder) {
        this.dsCurrVal = 0;
        this.restDecoder = decoder;
      }

      resetDsCurVal () {
        this.dsCurrVal = 0;
      }

      readDsClock () {
        this.dsCurrVal += readVarUint(this.restDecoder);
        return this.dsCurrVal
      }

      readDsLen () {
        const diff = readVarUint(this.restDecoder) + 1;
        this.dsCurrVal += diff;
        return diff
      }
    }

    class UpdateDecoderV2 extends DSDecoderV2 {
      /**
       * @param {decoding.Decoder} decoder
       */
      constructor (decoder) {
        super(decoder);
        /**
         * List of cached keys. If the keys[id] does not exist, we read a new key
         * from stringEncoder and push it to keys.
         *
         * @type {Array<string>}
         */
        this.keys = [];
        readUint8(decoder); // read feature flag - currently unused
        this.keyClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
        this.clientDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
        this.leftClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
        this.rightClockDecoder = new IntDiffOptRleDecoder(readVarUint8Array(decoder));
        this.infoDecoder = new RleDecoder(readVarUint8Array(decoder), readUint8);
        this.stringDecoder = new StringDecoder(readVarUint8Array(decoder));
        this.parentInfoDecoder = new RleDecoder(readVarUint8Array(decoder), readUint8);
        this.typeRefDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
        this.lenDecoder = new UintOptRleDecoder(readVarUint8Array(decoder));
      }

      /**
       * @return {ID}
       */
      readLeftID () {
        return new ID(this.clientDecoder.read(), this.leftClockDecoder.read())
      }

      /**
       * @return {ID}
       */
      readRightID () {
        return new ID(this.clientDecoder.read(), this.rightClockDecoder.read())
      }

      /**
       * Read the next client id.
       * Use this in favor of readID whenever possible to reduce the number of objects created.
       */
      readClient () {
        return this.clientDecoder.read()
      }

      /**
       * @return {number} info An unsigned 8-bit integer
       */
      readInfo () {
        return /** @type {number} */ (this.infoDecoder.read())
      }

      /**
       * @return {string}
       */
      readString () {
        return this.stringDecoder.read()
      }

      /**
       * @return {boolean}
       */
      readParentInfo () {
        return this.parentInfoDecoder.read() === 1
      }

      /**
       * @return {number} An unsigned 8-bit integer
       */
      readTypeRef () {
        return this.typeRefDecoder.read()
      }

      /**
       * Write len of a struct - well suited for Opt RLE encoder.
       *
       * @return {number}
       */
      readLen () {
        return this.lenDecoder.read()
      }

      /**
       * @return {any}
       */
      readAny () {
        return readAny(this.restDecoder)
      }

      /**
       * @return {Uint8Array}
       */
      readBuf () {
        return readVarUint8Array(this.restDecoder)
      }

      /**
       * This is mainly here for legacy purposes.
       *
       * Initial we incoded objects using JSON. Now we use the much faster lib0/any-encoder. This method mainly exists for legacy purposes for the v1 encoder.
       *
       * @return {any}
       */
      readJSON () {
        return readAny(this.restDecoder)
      }

      /**
       * @return {string}
       */
      readKey () {
        const keyClock = this.keyClockDecoder.read();
        if (keyClock < this.keys.length) {
          return this.keys[keyClock]
        } else {
          const key = this.stringDecoder.read();
          this.keys.push(key);
          return key
        }
      }
    }

    class DSEncoderV1 {
      constructor () {
        this.restEncoder = new Encoder();
      }

      toUint8Array () {
        return toUint8Array(this.restEncoder)
      }

      resetDsCurVal () {
        // nop
      }

      /**
       * @param {number} clock
       */
      writeDsClock (clock) {
        writeVarUint(this.restEncoder, clock);
      }

      /**
       * @param {number} len
       */
      writeDsLen (len) {
        writeVarUint(this.restEncoder, len);
      }
    }

    class UpdateEncoderV1 extends DSEncoderV1 {
      /**
       * @param {ID} id
       */
      writeLeftID (id) {
        writeVarUint(this.restEncoder, id.client);
        writeVarUint(this.restEncoder, id.clock);
      }

      /**
       * @param {ID} id
       */
      writeRightID (id) {
        writeVarUint(this.restEncoder, id.client);
        writeVarUint(this.restEncoder, id.clock);
      }

      /**
       * Use writeClient and writeClock instead of writeID if possible.
       * @param {number} client
       */
      writeClient (client) {
        writeVarUint(this.restEncoder, client);
      }

      /**
       * @param {number} info An unsigned 8-bit integer
       */
      writeInfo (info) {
        writeUint8(this.restEncoder, info);
      }

      /**
       * @param {string} s
       */
      writeString (s) {
        writeVarString(this.restEncoder, s);
      }

      /**
       * @param {boolean} isYKey
       */
      writeParentInfo (isYKey) {
        writeVarUint(this.restEncoder, isYKey ? 1 : 0);
      }

      /**
       * @param {number} info An unsigned 8-bit integer
       */
      writeTypeRef (info) {
        writeVarUint(this.restEncoder, info);
      }

      /**
       * Write len of a struct - well suited for Opt RLE encoder.
       *
       * @param {number} len
       */
      writeLen (len) {
        writeVarUint(this.restEncoder, len);
      }

      /**
       * @param {any} any
       */
      writeAny (any) {
        writeAny(this.restEncoder, any);
      }

      /**
       * @param {Uint8Array} buf
       */
      writeBuf (buf) {
        writeVarUint8Array(this.restEncoder, buf);
      }

      /**
       * @param {any} embed
       */
      writeJSON (embed) {
        writeVarString(this.restEncoder, JSON.stringify(embed));
      }

      /**
       * @param {string} key
       */
      writeKey (key) {
        writeVarString(this.restEncoder, key);
      }
    }

    class DSEncoderV2 {
      constructor () {
        this.restEncoder = new Encoder(); // encodes all the rest / non-optimized
        this.dsCurrVal = 0;
      }

      toUint8Array () {
        return toUint8Array(this.restEncoder)
      }

      resetDsCurVal () {
        this.dsCurrVal = 0;
      }

      /**
       * @param {number} clock
       */
      writeDsClock (clock) {
        const diff = clock - this.dsCurrVal;
        this.dsCurrVal = clock;
        writeVarUint(this.restEncoder, diff);
      }

      /**
       * @param {number} len
       */
      writeDsLen (len) {
        if (len === 0) {
          unexpectedCase();
        }
        writeVarUint(this.restEncoder, len - 1);
        this.dsCurrVal += len;
      }
    }

    class UpdateEncoderV2 extends DSEncoderV2 {
      constructor () {
        super();
        /**
         * @type {Map<string,number>}
         */
        this.keyMap = new Map();
        /**
         * Refers to the next uniqe key-identifier to me used.
         * See writeKey method for more information.
         *
         * @type {number}
         */
        this.keyClock = 0;
        this.keyClockEncoder = new IntDiffOptRleEncoder();
        this.clientEncoder = new UintOptRleEncoder();
        this.leftClockEncoder = new IntDiffOptRleEncoder();
        this.rightClockEncoder = new IntDiffOptRleEncoder();
        this.infoEncoder = new RleEncoder(writeUint8);
        this.stringEncoder = new StringEncoder();
        this.parentInfoEncoder = new RleEncoder(writeUint8);
        this.typeRefEncoder = new UintOptRleEncoder();
        this.lenEncoder = new UintOptRleEncoder();
      }

      toUint8Array () {
        const encoder = createEncoder();
        writeUint8(encoder, 0); // this is a feature flag that we might use in the future
        writeVarUint8Array(encoder, this.keyClockEncoder.toUint8Array());
        writeVarUint8Array(encoder, this.clientEncoder.toUint8Array());
        writeVarUint8Array(encoder, this.leftClockEncoder.toUint8Array());
        writeVarUint8Array(encoder, this.rightClockEncoder.toUint8Array());
        writeVarUint8Array(encoder, toUint8Array(this.infoEncoder));
        writeVarUint8Array(encoder, this.stringEncoder.toUint8Array());
        writeVarUint8Array(encoder, toUint8Array(this.parentInfoEncoder));
        writeVarUint8Array(encoder, this.typeRefEncoder.toUint8Array());
        writeVarUint8Array(encoder, this.lenEncoder.toUint8Array());
        // @note The rest encoder is appended! (note the missing var)
        writeUint8Array(encoder, toUint8Array(this.restEncoder));
        return toUint8Array(encoder)
      }

      /**
       * @param {ID} id
       */
      writeLeftID (id) {
        this.clientEncoder.write(id.client);
        this.leftClockEncoder.write(id.clock);
      }

      /**
       * @param {ID} id
       */
      writeRightID (id) {
        this.clientEncoder.write(id.client);
        this.rightClockEncoder.write(id.clock);
      }

      /**
       * @param {number} client
       */
      writeClient (client) {
        this.clientEncoder.write(client);
      }

      /**
       * @param {number} info An unsigned 8-bit integer
       */
      writeInfo (info) {
        this.infoEncoder.write(info);
      }

      /**
       * @param {string} s
       */
      writeString (s) {
        this.stringEncoder.write(s);
      }

      /**
       * @param {boolean} isYKey
       */
      writeParentInfo (isYKey) {
        this.parentInfoEncoder.write(isYKey ? 1 : 0);
      }

      /**
       * @param {number} info An unsigned 8-bit integer
       */
      writeTypeRef (info) {
        this.typeRefEncoder.write(info);
      }

      /**
       * Write len of a struct - well suited for Opt RLE encoder.
       *
       * @param {number} len
       */
      writeLen (len) {
        this.lenEncoder.write(len);
      }

      /**
       * @param {any} any
       */
      writeAny (any) {
        writeAny(this.restEncoder, any);
      }

      /**
       * @param {Uint8Array} buf
       */
      writeBuf (buf) {
        writeVarUint8Array(this.restEncoder, buf);
      }

      /**
       * This is mainly here for legacy purposes.
       *
       * Initial we incoded objects using JSON. Now we use the much faster lib0/any-encoder. This method mainly exists for legacy purposes for the v1 encoder.
       *
       * @param {any} embed
       */
      writeJSON (embed) {
        writeAny(this.restEncoder, embed);
      }

      /**
       * Property keys are often reused. For example, in y-prosemirror the key `bold` might
       * occur very often. For a 3d application, the key `position` might occur very often.
       *
       * We cache these keys in a Map and refer to them via a unique number.
       *
       * @param {string} key
       */
      writeKey (key) {
        const clock = this.keyMap.get(key);
        if (clock === undefined) {
          this.keyClockEncoder.write(this.keyClock++);
          this.stringEncoder.write(key);
        } else {
          this.keyClockEncoder.write(this.keyClock++);
        }
      }
    }

    let DefaultDSEncoder = DSEncoderV1;
    let DefaultDSDecoder = DSDecoderV1;
    let DefaultUpdateEncoder = UpdateEncoderV1;
    let DefaultUpdateDecoder = UpdateDecoderV1;

    /**
     * @param {AbstractUpdateEncoder} encoder
     * @param {Array<GC|Item>} structs All structs by `client`
     * @param {number} client
     * @param {number} clock write structs starting with `ID(client,clock)`
     *
     * @function
     */
    const writeStructs = (encoder, structs, client, clock) => {
      // write first id
      const startNewStructs = findIndexSS(structs, clock);
      // write # encoded structs
      writeVarUint(encoder.restEncoder, structs.length - startNewStructs);
      encoder.writeClient(client);
      writeVarUint(encoder.restEncoder, clock);
      const firstStruct = structs[startNewStructs];
      // write first struct with an offset
      firstStruct.write(encoder, clock - firstStruct.id.clock);
      for (let i = startNewStructs + 1; i < structs.length; i++) {
        structs[i].write(encoder, 0);
      }
    };

    /**
     * @param {AbstractUpdateEncoder} encoder
     * @param {StructStore} store
     * @param {Map<number,number>} _sm
     *
     * @private
     * @function
     */
    const writeClientsStructs = (encoder, store, _sm) => {
      // we filter all valid _sm entries into sm
      const sm = new Map();
      _sm.forEach((clock, client) => {
        // only write if new structs are available
        if (getState(store, client) > clock) {
          sm.set(client, clock);
        }
      });
      getStateVector(store).forEach((clock, client) => {
        if (!_sm.has(client)) {
          sm.set(client, 0);
        }
      });
      // write # states that were updated
      writeVarUint(encoder.restEncoder, sm.size);
      // Write items with higher client ids first
      // This heavily improves the conflict algorithm.
      Array.from(sm.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
        // @ts-ignore
        writeStructs(encoder, store.clients.get(client), client, clock);
      });
    };

    /**
     * @param {AbstractUpdateDecoder} decoder The decoder object to read data from.
     * @param {Map<number,Array<GC|Item>>} clientRefs
     * @param {Doc} doc
     * @return {Map<number,Array<GC|Item>>}
     *
     * @private
     * @function
     */
    const readClientsStructRefs = (decoder, clientRefs, doc) => {
      const numOfStateUpdates = readVarUint(decoder.restDecoder);
      for (let i = 0; i < numOfStateUpdates; i++) {
        const numberOfStructs = readVarUint(decoder.restDecoder);
        /**
         * @type {Array<GC|Item>}
         */
        const refs = new Array(numberOfStructs);
        const client = decoder.readClient();
        let clock = readVarUint(decoder.restDecoder);
        // const start = performance.now()
        clientRefs.set(client, refs);
        for (let i = 0; i < numberOfStructs; i++) {
          const info = decoder.readInfo();
          if ((BITS5 & info) !== 0) {
            /**
             * The optimized implementation doesn't use any variables because inlining variables is faster.
             * Below a non-optimized version is shown that implements the basic algorithm with
             * a few comments
             */
            const cantCopyParentInfo = (info & (BIT7 | BIT8)) === 0;
            // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
            // and we read the next string as parentYKey.
            // It indicates how we store/retrieve parent from `y.share`
            // @type {string|null}
            const struct = new Item(
              createID(client, clock),
              null, // leftd
              (info & BIT8) === BIT8 ? decoder.readLeftID() : null, // origin
              null, // right
              (info & BIT7) === BIT7 ? decoder.readRightID() : null, // right origin
              cantCopyParentInfo ? (decoder.readParentInfo() ? doc.get(decoder.readString()) : decoder.readLeftID()) : null, // parent
              cantCopyParentInfo && (info & BIT6) === BIT6 ? decoder.readString() : null, // parentSub
              readItemContent(decoder, info) // item content
            );
            /* A non-optimized implementation of the above algorithm:

            // The item that was originally to the left of this item.
            const origin = (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null
            // The item that was originally to the right of this item.
            const rightOrigin = (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null
            const cantCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
            const hasParentYKey = cantCopyParentInfo ? decoder.readParentInfo() : false
            // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
            // and we read the next string as parentYKey.
            // It indicates how we store/retrieve parent from `y.share`
            // @type {string|null}
            const parentYKey = cantCopyParentInfo && hasParentYKey ? decoder.readString() : null

            const struct = new Item(
              createID(client, clock),
              null, // leftd
              origin, // origin
              null, // right
              rightOrigin, // right origin
              cantCopyParentInfo && !hasParentYKey ? decoder.readLeftID() : (parentYKey !== null ? doc.get(parentYKey) : null), // parent
              cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
              readItemContent(decoder, info) // item content
            )
            */
            refs[i] = struct;
            clock += struct.length;
          } else {
            const len = decoder.readLen();
            refs[i] = new GC(createID(client, clock), len);
            clock += len;
          }
        }
        // console.log('time to read: ', performance.now() - start) // @todo remove
      }
      return clientRefs
    };

    /**
     * Resume computing structs generated by struct readers.
     *
     * While there is something to do, we integrate structs in this order
     * 1. top element on stack, if stack is not empty
     * 2. next element from current struct reader (if empty, use next struct reader)
     *
     * If struct causally depends on another struct (ref.missing), we put next reader of
     * `ref.id.client` on top of stack.
     *
     * At some point we find a struct that has no causal dependencies,
     * then we start emptying the stack.
     *
     * It is not possible to have circles: i.e. struct1 (from client1) depends on struct2 (from client2)
     * depends on struct3 (from client1). Therefore the max stack size is eqaul to `structReaders.length`.
     *
     * This method is implemented in a way so that we can resume computation if this update
     * causally depends on another update.
     *
     * @param {Transaction} transaction
     * @param {StructStore} store
     *
     * @private
     * @function
     */
    const resumeStructIntegration = (transaction, store) => {
      const stack = store.pendingStack; // @todo don't forget to append stackhead at the end
      const clientsStructRefs = store.pendingClientsStructRefs;
      // sort them so that we take the higher id first, in case of conflicts the lower id will probably not conflict with the id from the higher user.
      const clientsStructRefsIds = Array.from(clientsStructRefs.keys()).sort((a, b) => a - b);
      if (clientsStructRefsIds.length === 0) {
        return
      }
      const getNextStructTarget = () => {
        let nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]));
        while (nextStructsTarget.refs.length === nextStructsTarget.i) {
          clientsStructRefsIds.pop();
          if (clientsStructRefsIds.length > 0) {
            nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]));
          } else {
            store.pendingClientsStructRefs.clear();
            return null
          }
        }
        return nextStructsTarget
      };
      let curStructsTarget = getNextStructTarget();
      if (curStructsTarget === null && stack.length === 0) {
        return
      }
      /**
       * @type {GC|Item}
       */
      let stackHead = stack.length > 0
        ? /** @type {GC|Item} */ (stack.pop())
        : /** @type {any} */ (curStructsTarget).refs[/** @type {any} */ (curStructsTarget).i++];
      // caching the state because it is used very often
      const state = new Map();
      // iterate over all struct readers until we are done
      while (true) {
        const localClock = setIfUndefined(state, stackHead.id.client, () => getState(store, stackHead.id.client));
        const offset = stackHead.id.clock < localClock ? localClock - stackHead.id.clock : 0;
        if (stackHead.id.clock + offset !== localClock) {
          // A previous message from this client is missing
          // check if there is a pending structRef with a smaller clock and switch them
          /**
           * @type {{ refs: Array<GC|Item>, i: number }}
           */
          const structRefs = clientsStructRefs.get(stackHead.id.client) || { refs: [], i: 0 };
          if (structRefs.refs.length !== structRefs.i) {
            const r = structRefs.refs[structRefs.i];
            if (r.id.clock < stackHead.id.clock) {
              // put ref with smaller clock on stack instead and continue
              structRefs.refs[structRefs.i] = stackHead;
              stackHead = r;
              // sort the set because this approach might bring the list out of order
              structRefs.refs = structRefs.refs.slice(structRefs.i).sort((r1, r2) => r1.id.clock - r2.id.clock);
              structRefs.i = 0;
              continue
            }
          }
          // wait until missing struct is available
          stack.push(stackHead);
          return
        }
        const missing = stackHead.getMissing(transaction, store);
        if (missing === null) {
          if (offset === 0 || offset < stackHead.length) {
            stackHead.integrate(transaction, offset);
            state.set(stackHead.id.client, stackHead.id.clock + stackHead.length);
          }
          // iterate to next stackHead
          if (stack.length > 0) {
            stackHead = /** @type {GC|Item} */ (stack.pop());
          } else if (curStructsTarget !== null && curStructsTarget.i < curStructsTarget.refs.length) {
            stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++]);
          } else {
            curStructsTarget = getNextStructTarget();
            if (curStructsTarget === null) {
              // we are done!
              break
            } else {
              stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++]);
            }
          }
        } else {
          // get the struct reader that has the missing struct
          /**
           * @type {{ refs: Array<GC|Item>, i: number }}
           */
          const structRefs = clientsStructRefs.get(missing) || { refs: [], i: 0 };
          if (structRefs.refs.length === structRefs.i) {
            // This update message causally depends on another update message.
            stack.push(stackHead);
            return
          }
          stack.push(stackHead);
          stackHead = structRefs.refs[structRefs.i++];
        }
      }
      store.pendingClientsStructRefs.clear();
    };

    /**
     * @param {Transaction} transaction
     * @param {StructStore} store
     *
     * @private
     * @function
     */
    const tryResumePendingDeleteReaders = (transaction, store) => {
      const pendingReaders = store.pendingDeleteReaders;
      store.pendingDeleteReaders = [];
      for (let i = 0; i < pendingReaders.length; i++) {
        readAndApplyDeleteSet(pendingReaders[i], transaction, store);
      }
    };

    /**
     * @param {AbstractUpdateEncoder} encoder
     * @param {Transaction} transaction
     *
     * @private
     * @function
     */
    const writeStructsFromTransaction = (encoder, transaction) => writeClientsStructs(encoder, transaction.doc.store, transaction.beforeState);

    /**
     * @param {StructStore} store
     * @param {Map<number, Array<GC|Item>>} clientsStructsRefs
     *
     * @private
     * @function
     */
    const mergeReadStructsIntoPendingReads = (store, clientsStructsRefs) => {
      const pendingClientsStructRefs = store.pendingClientsStructRefs;
      clientsStructsRefs.forEach((structRefs, client) => {
        const pendingStructRefs = pendingClientsStructRefs.get(client);
        if (pendingStructRefs === undefined) {
          pendingClientsStructRefs.set(client, { refs: structRefs, i: 0 });
        } else {
          // merge into existing structRefs
          const merged = pendingStructRefs.i > 0 ? pendingStructRefs.refs.slice(pendingStructRefs.i) : pendingStructRefs.refs;
          for (let i = 0; i < structRefs.length; i++) {
            merged.push(structRefs[i]);
          }
          pendingStructRefs.i = 0;
          pendingStructRefs.refs = merged.sort((r1, r2) => r1.id.clock - r2.id.clock);
        }
      });
    };

    /**
     * @param {Map<number,{refs:Array<GC|Item>,i:number}>} pendingClientsStructRefs
     */
    const cleanupPendingStructs = pendingClientsStructRefs => {
      // cleanup pendingClientsStructs if not fully finished
      pendingClientsStructRefs.forEach((refs, client) => {
        if (refs.i === refs.refs.length) {
          pendingClientsStructRefs.delete(client);
        } else {
          refs.refs.splice(0, refs.i);
          refs.i = 0;
        }
      });
    };

    /**
     * Read the next Item in a Decoder and fill this Item with the read data.
     *
     * This is called when data is received from a remote peer.
     *
     * @param {AbstractUpdateDecoder} decoder The decoder object to read data from.
     * @param {Transaction} transaction
     * @param {StructStore} store
     *
     * @private
     * @function
     */
    const readStructs = (decoder, transaction, store) => {
      const clientsStructRefs = new Map();
      // let start = performance.now()
      readClientsStructRefs(decoder, clientsStructRefs, transaction.doc);
      // console.log('time to read structs: ', performance.now() - start) // @todo remove
      // start = performance.now()
      mergeReadStructsIntoPendingReads(store, clientsStructRefs);
      // console.log('time to merge: ', performance.now() - start) // @todo remove
      // start = performance.now()
      resumeStructIntegration(transaction, store);
      // console.log('time to integrate: ', performance.now() - start) // @todo remove
      // start = performance.now()
      cleanupPendingStructs(store.pendingClientsStructRefs);
      // console.log('time to cleanup: ', performance.now() - start) // @todo remove
      // start = performance.now()
      tryResumePendingDeleteReaders(transaction, store);
      // console.log('time to resume delete readers: ', performance.now() - start) // @todo remove
      // start = performance.now()
    };

    /**
     * Read and apply a document update.
     *
     * This function has the same effect as `applyUpdate` but accepts an decoder.
     *
     * @param {decoding.Decoder} decoder
     * @param {Doc} ydoc
     * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
     * @param {AbstractUpdateDecoder} [structDecoder]
     *
     * @function
     */
    const readUpdateV2 = (decoder, ydoc, transactionOrigin, structDecoder = new UpdateDecoderV2(decoder)) =>
      transact(ydoc, transaction => {
        readStructs(structDecoder, transaction, ydoc.store);
        readAndApplyDeleteSet(structDecoder, transaction, ydoc.store);
      }, transactionOrigin, false);

    /**
     * Read and apply a document update.
     *
     * This function has the same effect as `applyUpdate` but accepts an decoder.
     *
     * @param {decoding.Decoder} decoder
     * @param {Doc} ydoc
     * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
     *
     * @function
     */
    const readUpdate = (decoder, ydoc, transactionOrigin) => readUpdateV2(decoder, ydoc, transactionOrigin, new DefaultUpdateDecoder(decoder));

    /**
     * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
     *
     * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
     *
     * @param {Doc} ydoc
     * @param {Uint8Array} update
     * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
     * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
     *
     * @function
     */
    const applyUpdateV2 = (ydoc, update, transactionOrigin, YDecoder = UpdateDecoderV2) => {
      const decoder = createDecoder(update);
      readUpdateV2(decoder, ydoc, transactionOrigin, new YDecoder(decoder));
    };

    /**
     * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
     *
     * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
     *
     * @param {Doc} ydoc
     * @param {Uint8Array} update
     * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
     *
     * @function
     */
    const applyUpdate = (ydoc, update, transactionOrigin) => applyUpdateV2(ydoc, update, transactionOrigin, DefaultUpdateDecoder);

    /**
     * Write all the document as a single update message. If you specify the state of the remote client (`targetStateVector`) it will
     * only write the operations that are missing.
     *
     * @param {AbstractUpdateEncoder} encoder
     * @param {Doc} doc
     * @param {Map<number,number>} [targetStateVector] The state of the target that receives the update. Leave empty to write all known structs
     *
     * @function
     */
    const writeStateAsUpdate = (encoder, doc, targetStateVector = new Map()) => {
      writeClientsStructs(encoder, doc.store, targetStateVector);
      writeDeleteSet(encoder, createDeleteSetFromStructStore(doc.store));
    };

    /**
     * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
     * only write the operations that are missing.
     *
     * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
     *
     * @param {Doc} doc
     * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
     * @param {AbstractUpdateEncoder} [encoder]
     * @return {Uint8Array}
     *
     * @function
     */
    const encodeStateAsUpdateV2 = (doc, encodedTargetStateVector, encoder = new UpdateEncoderV2()) => {
      const targetStateVector = encodedTargetStateVector == null ? new Map() : decodeStateVector(encodedTargetStateVector);
      writeStateAsUpdate(encoder, doc, targetStateVector);
      return encoder.toUint8Array()
    };

    /**
     * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
     * only write the operations that are missing.
     *
     * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
     *
     * @param {Doc} doc
     * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
     * @return {Uint8Array}
     *
     * @function
     */
    const encodeStateAsUpdate = (doc, encodedTargetStateVector) => encodeStateAsUpdateV2(doc, encodedTargetStateVector, new DefaultUpdateEncoder());

    /**
     * Read state vector from Decoder and return as Map
     *
     * @param {AbstractDSDecoder} decoder
     * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
     *
     * @function
     */
    const readStateVector = decoder => {
      const ss = new Map();
      const ssLength = readVarUint(decoder.restDecoder);
      for (let i = 0; i < ssLength; i++) {
        const client = readVarUint(decoder.restDecoder);
        const clock = readVarUint(decoder.restDecoder);
        ss.set(client, clock);
      }
      return ss
    };

    /**
     * Read decodedState and return State as Map.
     *
     * @param {Uint8Array} decodedState
     * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
     *
     * @function
     */
    const decodeStateVectorV2 = decodedState => readStateVector(new DSDecoderV2(createDecoder(decodedState)));

    /**
     * Read decodedState and return State as Map.
     *
     * @param {Uint8Array} decodedState
     * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
     *
     * @function
     */
    const decodeStateVector = decodedState => readStateVector(new DefaultDSDecoder(createDecoder(decodedState)));

    /**
     * @param {AbstractDSEncoder} encoder
     * @param {Map<number,number>} sv
     * @function
     */
    const writeStateVector = (encoder, sv) => {
      writeVarUint(encoder.restEncoder, sv.size);
      sv.forEach((clock, client) => {
        writeVarUint(encoder.restEncoder, client); // @todo use a special client decoder that is based on mapping
        writeVarUint(encoder.restEncoder, clock);
      });
      return encoder
    };

    /**
     * @param {AbstractDSEncoder} encoder
     * @param {Doc} doc
     *
     * @function
     */
    const writeDocumentStateVector = (encoder, doc) => writeStateVector(encoder, getStateVector(doc.store));

    /**
     * Encode State as Uint8Array.
     *
     * @param {Doc} doc
     * @param {AbstractDSEncoder} [encoder]
     * @return {Uint8Array}
     *
     * @function
     */
    const encodeStateVectorV2 = (doc, encoder = new DSEncoderV2()) => {
      writeDocumentStateVector(encoder, doc);
      return encoder.toUint8Array()
    };

    /**
     * Encode State as Uint8Array.
     *
     * @param {Doc} doc
     * @return {Uint8Array}
     *
     * @function
     */
    const encodeStateVector = doc => encodeStateVectorV2(doc, new DefaultDSEncoder());

    /**
     * General event handler implementation.
     *
     * @template ARG0, ARG1
     *
     * @private
     */
    class EventHandler {
      constructor () {
        /**
         * @type {Array<function(ARG0, ARG1):void>}
         */
        this.l = [];
      }
    }

    /**
     * @template ARG0,ARG1
     * @returns {EventHandler<ARG0,ARG1>}
     *
     * @private
     * @function
     */
    const createEventHandler = () => new EventHandler();

    /**
     * Adds an event listener that is called when
     * {@link EventHandler#callEventListeners} is called.
     *
     * @template ARG0,ARG1
     * @param {EventHandler<ARG0,ARG1>} eventHandler
     * @param {function(ARG0,ARG1):void} f The event handler.
     *
     * @private
     * @function
     */
    const addEventHandlerListener = (eventHandler, f) =>
      eventHandler.l.push(f);

    /**
     * Removes an event listener.
     *
     * @template ARG0,ARG1
     * @param {EventHandler<ARG0,ARG1>} eventHandler
     * @param {function(ARG0,ARG1):void} f The event handler that was added with
     *                     {@link EventHandler#addEventListener}
     *
     * @private
     * @function
     */
    const removeEventHandlerListener = (eventHandler, f) => {
      eventHandler.l = eventHandler.l.filter(g => f !== g);
    };

    /**
     * Call all event listeners that were added via
     * {@link EventHandler#addEventListener}.
     *
     * @template ARG0,ARG1
     * @param {EventHandler<ARG0,ARG1>} eventHandler
     * @param {ARG0} arg0
     * @param {ARG1} arg1
     *
     * @private
     * @function
     */
    const callEventHandlerListeners = (eventHandler, arg0, arg1) =>
      callAll(eventHandler.l, [arg0, arg1]);

    class ID {
      /**
       * @param {number} client client id
       * @param {number} clock unique per client id, continuous number
       */
      constructor (client, clock) {
        /**
         * Client id
         * @type {number}
         */
        this.client = client;
        /**
         * unique per client id, continuous number
         * @type {number}
         */
        this.clock = clock;
      }
    }

    /**
     * @param {ID | null} a
     * @param {ID | null} b
     * @return {boolean}
     *
     * @function
     */
    const compareIDs = (a, b) => a === b || (a !== null && b !== null && a.client === b.client && a.clock === b.clock);

    /**
     * @param {number} client
     * @param {number} clock
     *
     * @private
     * @function
     */
    const createID = (client, clock) => new ID(client, clock);

    /**
     * @param {encoding.Encoder} encoder
     * @param {ID} id
     *
     * @private
     * @function
     */
    const writeID = (encoder, id) => {
      writeVarUint(encoder, id.client);
      writeVarUint(encoder, id.clock);
    };

    /**
     * Read ID.
     * * If first varUint read is 0xFFFFFF a RootID is returned.
     * * Otherwise an ID is returned
     *
     * @param {decoding.Decoder} decoder
     * @return {ID}
     *
     * @private
     * @function
     */
    const readID = decoder =>
      createID(readVarUint(decoder), readVarUint(decoder));

    /**
     * The top types are mapped from y.share.get(keyname) => type.
     * `type` does not store any information about the `keyname`.
     * This function finds the correct `keyname` for `type` and throws otherwise.
     *
     * @param {AbstractType<any>} type
     * @return {string}
     *
     * @private
     * @function
     */
    const findRootTypeKey = type => {
      // @ts-ignore _y must be defined, otherwise unexpected case
      for (const [key, value] of type.doc.share.entries()) {
        if (value === type) {
          return key
        }
      }
      throw unexpectedCase()
    };

    /**
     * Check if `parent` is a parent of `child`.
     *
     * @param {AbstractType<any>} parent
     * @param {Item|null} child
     * @return {Boolean} Whether `parent` is a parent of `child`.
     *
     * @private
     * @function
     */
    const isParentOf = (parent, child) => {
      while (child !== null) {
        if (child.parent === parent) {
          return true
        }
        child = /** @type {AbstractType<any>} */ (child.parent)._item;
      }
      return false
    };

    /**
     * Convenient helper to log type information.
     *
     * Do not use in productive systems as the output can be immense!
     *
     * @param {AbstractType<any>} type
     */
    const logType = type => {
      const res = [];
      let n = type._start;
      while (n) {
        res.push(n);
        n = n.right;
      }
      console.log('Children: ', res);
      console.log('Children content: ', res.filter(m => !m.deleted).map(m => m.content));
    };

    class PermanentUserData {
      /**
       * @param {Doc} doc
       * @param {YMap<any>} [storeType]
       */
      constructor (doc, storeType = doc.getMap('users')) {
        /**
         * @type {Map<string,DeleteSet>}
         */
        const dss = new Map();
        this.yusers = storeType;
        this.doc = doc;
        /**
         * Maps from clientid to userDescription
         *
         * @type {Map<number,string>}
         */
        this.clients = new Map();
        this.dss = dss;
        /**
         * @param {YMap<any>} user
         * @param {string} userDescription
         */
        const initUser = (user, userDescription) => {
          /**
           * @type {YArray<Uint8Array>}
           */
          const ds = user.get('ds');
          const ids = user.get('ids');
          const addClientId = /** @param {number} clientid */ clientid => this.clients.set(clientid, userDescription);
          ds.observe(/** @param {YArrayEvent<any>} event */ event => {
            event.changes.added.forEach(item => {
              item.content.getContent().forEach(encodedDs => {
                if (encodedDs instanceof Uint8Array) {
                  this.dss.set(userDescription, mergeDeleteSets([this.dss.get(userDescription) || createDeleteSet(), readDeleteSet(new DSDecoderV1(createDecoder(encodedDs)))]));
                }
              });
            });
          });
          this.dss.set(userDescription, mergeDeleteSets(ds.map(encodedDs => readDeleteSet(new DSDecoderV1(createDecoder(encodedDs))))));
          ids.observe(/** @param {YArrayEvent<any>} event */ event =>
            event.changes.added.forEach(item => item.content.getContent().forEach(addClientId))
          );
          ids.forEach(addClientId);
        };
        // observe users
        storeType.observe(event => {
          event.keysChanged.forEach(userDescription =>
            initUser(storeType.get(userDescription), userDescription)
          );
        });
        // add intial data
        storeType.forEach(initUser);
      }

      /**
       * @param {Doc} doc
       * @param {number} clientid
       * @param {string} userDescription
       * @param {Object} [conf]
       * @param {function(Transaction, DeleteSet):boolean} [conf.filter]
       */
      setUserMapping (doc, clientid, userDescription, { filter = () => true } = {}) {
        const users = this.yusers;
        let user = users.get(userDescription);
        if (!user) {
          user = new YMap();
          user.set('ids', new YArray());
          user.set('ds', new YArray());
          users.set(userDescription, user);
        }
        user.get('ids').push([clientid]);
        users.observe(event => {
          setTimeout(() => {
            const userOverwrite = users.get(userDescription);
            if (userOverwrite !== user) {
              // user was overwritten, port all data over to the next user object
              // @todo Experiment with Y.Sets here
              user = userOverwrite;
              // @todo iterate over old type
              this.clients.forEach((_userDescription, clientid) => {
                if (userDescription === _userDescription) {
                  user.get('ids').push([clientid]);
                }
              });
              const encoder = new DSEncoderV1();
              const ds = this.dss.get(userDescription);
              if (ds) {
                writeDeleteSet(encoder, ds);
                user.get('ds').push([encoder.toUint8Array()]);
              }
            }
          }, 0);
        });
        doc.on('afterTransaction', /** @param {Transaction} transaction */ transaction => {
          setTimeout(() => {
            const yds = user.get('ds');
            const ds = transaction.deleteSet;
            if (transaction.local && ds.clients.size > 0 && filter(transaction, ds)) {
              const encoder = new DSEncoderV1();
              writeDeleteSet(encoder, ds);
              yds.push([encoder.toUint8Array()]);
            }
          });
        });
      }

      /**
       * @param {number} clientid
       * @return {any}
       */
      getUserByClientId (clientid) {
        return this.clients.get(clientid) || null
      }

      /**
       * @param {ID} id
       * @return {string | null}
       */
      getUserByDeletedId (id) {
        for (const [userDescription, ds] of this.dss.entries()) {
          if (isDeleted(ds, id)) {
            return userDescription
          }
        }
        return null
      }
    }

    /**
     * A relative position is based on the Yjs model and is not affected by document changes.
     * E.g. If you place a relative position before a certain character, it will always point to this character.
     * If you place a relative position at the end of a type, it will always point to the end of the type.
     *
     * A numeric position is often unsuited for user selections, because it does not change when content is inserted
     * before or after.
     *
     * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the relative position.
     *
     * One of the properties must be defined.
     *
     * @example
     *   // Current cursor position is at position 10
     *   const relativePosition = createRelativePositionFromIndex(yText, 10)
     *   // modify yText
     *   yText.insert(0, 'abc')
     *   yText.delete(3, 10)
     *   // Compute the cursor position
     *   const absolutePosition = createAbsolutePositionFromRelativePosition(y, relativePosition)
     *   absolutePosition.type === yText // => true
     *   console.log('cursor location is ' + absolutePosition.index) // => cursor location is 3
     *
     */
    class RelativePosition {
      /**
       * @param {ID|null} type
       * @param {string|null} tname
       * @param {ID|null} item
       */
      constructor (type, tname, item) {
        /**
         * @type {ID|null}
         */
        this.type = type;
        /**
         * @type {string|null}
         */
        this.tname = tname;
        /**
         * @type {ID | null}
         */
        this.item = item;
      }
    }

    /**
     * @param {any} json
     * @return {RelativePosition}
     *
     * @function
     */
    const createRelativePositionFromJSON = json => new RelativePosition(json.type == null ? null : createID(json.type.client, json.type.clock), json.tname || null, json.item == null ? null : createID(json.item.client, json.item.clock));

    class AbsolutePosition {
      /**
       * @param {AbstractType<any>} type
       * @param {number} index
       */
      constructor (type, index) {
        /**
         * @type {AbstractType<any>}
         */
        this.type = type;
        /**
         * @type {number}
         */
        this.index = index;
      }
    }

    /**
     * @param {AbstractType<any>} type
     * @param {number} index
     *
     * @function
     */
    const createAbsolutePosition = (type, index) => new AbsolutePosition(type, index);

    /**
     * @param {AbstractType<any>} type
     * @param {ID|null} item
     *
     * @function
     */
    const createRelativePosition = (type, item) => {
      let typeid = null;
      let tname = null;
      if (type._item === null) {
        tname = findRootTypeKey(type);
      } else {
        typeid = createID(type._item.id.client, type._item.id.clock);
      }
      return new RelativePosition(typeid, tname, item)
    };

    /**
     * Create a relativePosition based on a absolute position.
     *
     * @param {AbstractType<any>} type The base type (e.g. YText or YArray).
     * @param {number} index The absolute position.
     * @return {RelativePosition}
     *
     * @function
     */
    const createRelativePositionFromTypeIndex = (type, index) => {
      let t = type._start;
      while (t !== null) {
        if (!t.deleted && t.countable) {
          if (t.length > index) {
            // case 1: found position somewhere in the linked list
            return createRelativePosition(type, createID(t.id.client, t.id.clock + index))
          }
          index -= t.length;
        }
        t = t.right;
      }
      return createRelativePosition(type, null)
    };

    /**
     * @param {encoding.Encoder} encoder
     * @param {RelativePosition} rpos
     *
     * @function
     */
    const writeRelativePosition = (encoder, rpos) => {
      const { type, tname, item } = rpos;
      if (item !== null) {
        writeVarUint(encoder, 0);
        writeID(encoder, item);
      } else if (tname !== null) {
        // case 2: found position at the end of the list and type is stored in y.share
        writeUint8(encoder, 1);
        writeVarString(encoder, tname);
      } else if (type !== null) {
        // case 3: found position at the end of the list and type is attached to an item
        writeUint8(encoder, 2);
        writeID(encoder, type);
      } else {
        throw unexpectedCase()
      }
      return encoder
    };

    /**
     * @param {decoding.Decoder} decoder
     * @return {RelativePosition|null}
     *
     * @function
     */
    const readRelativePosition = decoder => {
      let type = null;
      let tname = null;
      let itemID = null;
      switch (readVarUint(decoder)) {
        case 0:
          // case 1: found position somewhere in the linked list
          itemID = readID(decoder);
          break
        case 1:
          // case 2: found position at the end of the list and type is stored in y.share
          tname = readVarString(decoder);
          break
        case 2: {
          // case 3: found position at the end of the list and type is attached to an item
          type = readID(decoder);
        }
      }
      return new RelativePosition(type, tname, itemID)
    };

    /**
     * @param {RelativePosition} rpos
     * @param {Doc} doc
     * @return {AbsolutePosition|null}
     *
     * @function
     */
    const createAbsolutePositionFromRelativePosition = (rpos, doc) => {
      const store = doc.store;
      const rightID = rpos.item;
      const typeID = rpos.type;
      const tname = rpos.tname;
      let type = null;
      let index = 0;
      if (rightID !== null) {
        if (getState(store, rightID.client) <= rightID.clock) {
          return null
        }
        const res = followRedone(store, rightID);
        const right = res.item;
        if (!(right instanceof Item)) {
          return null
        }
        type = /** @type {AbstractType<any>} */ (right.parent);
        if (type._item === null || !type._item.deleted) {
          index = right.deleted || !right.countable ? 0 : res.diff;
          let n = right.left;
          while (n !== null) {
            if (!n.deleted && n.countable) {
              index += n.length;
            }
            n = n.left;
          }
        }
      } else {
        if (tname !== null) {
          type = doc.get(tname);
        } else if (typeID !== null) {
          if (getState(store, typeID.client) <= typeID.clock) {
            // type does not exist yet
            return null
          }
          const { item } = followRedone(store, typeID);
          if (item instanceof Item && item.content instanceof ContentType) {
            type = item.content.type;
          } else {
            // struct is garbage collected
            return null
          }
        } else {
          throw unexpectedCase()
        }
        index = type._length;
      }
      return createAbsolutePosition(type, index)
    };

    /**
     * @param {RelativePosition|null} a
     * @param {RelativePosition|null} b
     *
     * @function
     */
    const compareRelativePositions = (a, b) => a === b || (
      a !== null && b !== null && a.tname === b.tname && compareIDs(a.item, b.item) && compareIDs(a.type, b.type)
    );

    class Snapshot {
      /**
       * @param {DeleteSet} ds
       * @param {Map<number,number>} sv state map
       */
      constructor (ds, sv) {
        /**
         * @type {DeleteSet}
         */
        this.ds = ds;
        /**
         * State Map
         * @type {Map<number,number>}
         */
        this.sv = sv;
      }
    }

    /**
     * @param {Snapshot} snap1
     * @param {Snapshot} snap2
     * @return {boolean}
     */
    const equalSnapshots = (snap1, snap2) => {
      const ds1 = snap1.ds.clients;
      const ds2 = snap2.ds.clients;
      const sv1 = snap1.sv;
      const sv2 = snap2.sv;
      if (sv1.size !== sv2.size || ds1.size !== ds2.size) {
        return false
      }
      for (const [key, value] of sv1.entries()) {
        if (sv2.get(key) !== value) {
          return false
        }
      }
      for (const [client, dsitems1] of ds1.entries()) {
        const dsitems2 = ds2.get(client) || [];
        if (dsitems1.length !== dsitems2.length) {
          return false
        }
        for (let i = 0; i < dsitems1.length; i++) {
          const dsitem1 = dsitems1[i];
          const dsitem2 = dsitems2[i];
          if (dsitem1.clock !== dsitem2.clock || dsitem1.len !== dsitem2.len) {
            return false
          }
        }
      }
      return true
    };

    /**
     * @param {Snapshot} snapshot
     * @param {AbstractDSEncoder} [encoder]
     * @return {Uint8Array}
     */
    const encodeSnapshotV2 = (snapshot, encoder = new DSEncoderV2()) => {
      writeDeleteSet(encoder, snapshot.ds);
      writeStateVector(encoder, snapshot.sv);
      return encoder.toUint8Array()
    };

    /**
     * @param {Snapshot} snapshot
     * @return {Uint8Array}
     */
    const encodeSnapshot = snapshot => encodeSnapshotV2(snapshot, new DefaultDSEncoder());

    /**
     * @param {Uint8Array} buf
     * @param {AbstractDSDecoder} [decoder]
     * @return {Snapshot}
     */
    const decodeSnapshotV2 = (buf, decoder = new DSDecoderV2(createDecoder(buf))) => {
      return new Snapshot(readDeleteSet(decoder), readStateVector(decoder))
    };

    /**
     * @param {Uint8Array} buf
     * @return {Snapshot}
     */
    const decodeSnapshot = buf => decodeSnapshotV2(buf, new DSDecoderV1(createDecoder(buf)));

    /**
     * @param {DeleteSet} ds
     * @param {Map<number,number>} sm
     * @return {Snapshot}
     */
    const createSnapshot = (ds, sm) => new Snapshot(ds, sm);

    const emptySnapshot = createSnapshot(createDeleteSet(), new Map());

    /**
     * @param {Doc} doc
     * @return {Snapshot}
     */
    const snapshot = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store));

    /**
     * @param {Item} item
     * @param {Snapshot|undefined} snapshot
     *
     * @protected
     * @function
     */
    const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
      snapshot.sv.has(item.id.client) && (snapshot.sv.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
    );

    /**
     * @param {Transaction} transaction
     * @param {Snapshot} snapshot
     */
    const splitSnapshotAffectedStructs = (transaction, snapshot) => {
      const meta = setIfUndefined(transaction.meta, splitSnapshotAffectedStructs, create$1);
      const store = transaction.doc.store;
      // check if we already split for this snapshot
      if (!meta.has(snapshot)) {
        snapshot.sv.forEach((clock, client) => {
          if (clock < getState(store, client)) {
            getItemCleanStart(transaction, createID(client, clock));
          }
        });
        iterateDeletedStructs(transaction, snapshot.ds, item => {});
        meta.add(snapshot);
      }
    };

    /**
     * @param {Doc} originDoc
     * @param {Snapshot} snapshot
     * @param {Doc} [newDoc] Optionally, you may define the Yjs document that receives the data from originDoc
     * @return {Doc}
     */
    const createDocFromSnapshot = (originDoc, snapshot, newDoc = new Doc()) => {
      if (originDoc.gc) {
        // we should not try to restore a GC-ed document, because some of the restored items might have their content deleted
        throw new Error('originDoc must not be garbage collected')
      }
      const { sv, ds } = snapshot;

      const encoder = new UpdateEncoderV2();
      originDoc.transact(transaction => {
        let size = 0;
        sv.forEach(clock => {
          if (clock > 0) {
            size++;
          }
        });
        writeVarUint(encoder.restEncoder, size);
        // splitting the structs before writing them to the encoder
        for (const [client, clock] of sv) {
          if (clock === 0) {
            continue
          }
          if (clock < getState(originDoc.store, client)) {
            getItemCleanStart(transaction, createID(client, clock));
          }
          const structs = originDoc.store.clients.get(client) || [];
          const lastStructIndex = findIndexSS(structs, clock - 1);
          // write # encoded structs
          writeVarUint(encoder.restEncoder, lastStructIndex + 1);
          encoder.writeClient(client);
          // first clock written is 0
          writeVarUint(encoder.restEncoder, 0);
          for (let i = 0; i <= lastStructIndex; i++) {
            structs[i].write(encoder, 0);
          }
        }
        writeDeleteSet(encoder, ds);
      });

      applyUpdateV2(newDoc, encoder.toUint8Array(), 'snapshot');
      return newDoc
    };

    class StructStore {
      constructor () {
        /**
         * @type {Map<number,Array<GC|Item>>}
         */
        this.clients = new Map();
        /**
         * Store incompleted struct reads here
         * `i` denotes to the next read operation
         * We could shift the array of refs instead, but shift is incredible
         * slow in Chrome for arrays with more than 100k elements
         * @see tryResumePendingStructRefs
         * @type {Map<number,{i:number,refs:Array<GC|Item>}>}
         */
        this.pendingClientsStructRefs = new Map();
        /**
         * Stack of pending structs waiting for struct dependencies
         * Maximum length of stack is structReaders.size
         * @type {Array<GC|Item>}
         */
        this.pendingStack = [];
        /**
         * @type {Array<DSDecoderV2>}
         */
        this.pendingDeleteReaders = [];
      }
    }

    /**
     * Return the states as a Map<client,clock>.
     * Note that clock refers to the next expected clock id.
     *
     * @param {StructStore} store
     * @return {Map<number,number>}
     *
     * @public
     * @function
     */
    const getStateVector = store => {
      const sm = new Map();
      store.clients.forEach((structs, client) => {
        const struct = structs[structs.length - 1];
        sm.set(client, struct.id.clock + struct.length);
      });
      return sm
    };

    /**
     * @param {StructStore} store
     * @param {number} client
     * @return {number}
     *
     * @public
     * @function
     */
    const getState = (store, client) => {
      const structs = store.clients.get(client);
      if (structs === undefined) {
        return 0
      }
      const lastStruct = structs[structs.length - 1];
      return lastStruct.id.clock + lastStruct.length
    };

    /**
     * @param {StructStore} store
     * @param {GC|Item} struct
     *
     * @private
     * @function
     */
    const addStruct = (store, struct) => {
      let structs = store.clients.get(struct.id.client);
      if (structs === undefined) {
        structs = [];
        store.clients.set(struct.id.client, structs);
      } else {
        const lastStruct = structs[structs.length - 1];
        if (lastStruct.id.clock + lastStruct.length !== struct.id.clock) {
          throw unexpectedCase()
        }
      }
      structs.push(struct);
    };

    /**
     * Perform a binary search on a sorted array
     * @param {Array<Item|GC>} structs
     * @param {number} clock
     * @return {number}
     *
     * @private
     * @function
     */
    const findIndexSS = (structs, clock) => {
      let left = 0;
      let right = structs.length - 1;
      let mid = structs[right];
      let midclock = mid.id.clock;
      if (midclock === clock) {
        return right
      }
      // @todo does it even make sense to pivot the search?
      // If a good split misses, it might actually increase the time to find the correct item.
      // Currently, the only advantage is that search with pivoting might find the item on the first try.
      let midindex = floor((clock / (midclock + mid.length - 1)) * right); // pivoting the search
      while (left <= right) {
        mid = structs[midindex];
        midclock = mid.id.clock;
        if (midclock <= clock) {
          if (clock < midclock + mid.length) {
            return midindex
          }
          left = midindex + 1;
        } else {
          right = midindex - 1;
        }
        midindex = floor((left + right) / 2);
      }
      // Always check state before looking for a struct in StructStore
      // Therefore the case of not finding a struct is unexpected
      throw unexpectedCase()
    };

    /**
     * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
     *
     * @param {StructStore} store
     * @param {ID} id
     * @return {GC|Item}
     *
     * @private
     * @function
     */
    const find = (store, id) => {
      /**
       * @type {Array<GC|Item>}
       */
      // @ts-ignore
      const structs = store.clients.get(id.client);
      return structs[findIndexSS(structs, id.clock)]
    };

    /**
     * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
     * @private
     * @function
     */
    const getItem = /** @type {function(StructStore,ID):Item} */ (find);

    /**
     * @param {Transaction} transaction
     * @param {Array<Item|GC>} structs
     * @param {number} clock
     */
    const findIndexCleanStart = (transaction, structs, clock) => {
      const index = findIndexSS(structs, clock);
      const struct = structs[index];
      if (struct.id.clock < clock && struct instanceof Item) {
        structs.splice(index + 1, 0, splitItem(transaction, struct, clock - struct.id.clock));
        return index + 1
      }
      return index
    };

    /**
     * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
     *
     * @param {Transaction} transaction
     * @param {ID} id
     * @return {Item}
     *
     * @private
     * @function
     */
    const getItemCleanStart = (transaction, id) => {
      const structs = /** @type {Array<Item>} */ (transaction.doc.store.clients.get(id.client));
      return structs[findIndexCleanStart(transaction, structs, id.clock)]
    };

    /**
     * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
     *
     * @param {Transaction} transaction
     * @param {StructStore} store
     * @param {ID} id
     * @return {Item}
     *
     * @private
     * @function
     */
    const getItemCleanEnd = (transaction, store, id) => {
      /**
       * @type {Array<Item>}
       */
      // @ts-ignore
      const structs = store.clients.get(id.client);
      const index = findIndexSS(structs, id.clock);
      const struct = structs[index];
      if (id.clock !== struct.id.clock + struct.length - 1 && struct.constructor !== GC) {
        structs.splice(index + 1, 0, splitItem(transaction, struct, id.clock - struct.id.clock + 1));
      }
      return struct
    };

    /**
     * Replace `item` with `newitem` in store
     * @param {StructStore} store
     * @param {GC|Item} struct
     * @param {GC|Item} newStruct
     *
     * @private
     * @function
     */
    const replaceStruct = (store, struct, newStruct) => {
      const structs = /** @type {Array<GC|Item>} */ (store.clients.get(struct.id.client));
      structs[findIndexSS(structs, struct.id.clock)] = newStruct;
    };

    /**
     * Iterate over a range of structs
     *
     * @param {Transaction} transaction
     * @param {Array<Item|GC>} structs
     * @param {number} clockStart Inclusive start
     * @param {number} len
     * @param {function(GC|Item):void} f
     *
     * @function
     */
    const iterateStructs = (transaction, structs, clockStart, len, f) => {
      if (len === 0) {
        return
      }
      const clockEnd = clockStart + len;
      let index = findIndexCleanStart(transaction, structs, clockStart);
      let struct;
      do {
        struct = structs[index++];
        if (clockEnd < struct.id.clock + struct.length) {
          findIndexCleanStart(transaction, structs, clockEnd);
        }
        f(struct);
      } while (index < structs.length && structs[index].id.clock < clockEnd)
    };

    /**
     * A transaction is created for every change on the Yjs model. It is possible
     * to bundle changes on the Yjs model in a single transaction to
     * minimize the number on messages sent and the number of observer calls.
     * If possible the user of this library should bundle as many changes as
     * possible. Here is an example to illustrate the advantages of bundling:
     *
     * @example
     * const map = y.define('map', YMap)
     * // Log content when change is triggered
     * map.observe(() => {
     *   console.log('change triggered')
     * })
     * // Each change on the map type triggers a log message:
     * map.set('a', 0) // => "change triggered"
     * map.set('b', 0) // => "change triggered"
     * // When put in a transaction, it will trigger the log after the transaction:
     * y.transact(() => {
     *   map.set('a', 1)
     *   map.set('b', 1)
     * }) // => "change triggered"
     *
     * @public
     */
    class Transaction {
      /**
       * @param {Doc} doc
       * @param {any} origin
       * @param {boolean} local
       */
      constructor (doc, origin, local) {
        /**
         * The Yjs instance.
         * @type {Doc}
         */
        this.doc = doc;
        /**
         * Describes the set of deleted items by ids
         * @type {DeleteSet}
         */
        this.deleteSet = new DeleteSet();
        /**
         * Holds the state before the transaction started.
         * @type {Map<Number,Number>}
         */
        this.beforeState = getStateVector(doc.store);
        /**
         * Holds the state after the transaction.
         * @type {Map<Number,Number>}
         */
        this.afterState = new Map();
        /**
         * All types that were directly modified (property added or child
         * inserted/deleted). New types are not included in this Set.
         * Maps from type to parentSubs (`item.parentSub = null` for YArray)
         * @type {Map<AbstractType<YEvent>,Set<String|null>>}
         */
        this.changed = new Map();
        /**
         * Stores the events for the types that observe also child elements.
         * It is mainly used by `observeDeep`.
         * @type {Map<AbstractType<YEvent>,Array<YEvent>>}
         */
        this.changedParentTypes = new Map();
        /**
         * @type {Array<AbstractStruct>}
         */
        this._mergeStructs = [];
        /**
         * @type {any}
         */
        this.origin = origin;
        /**
         * Stores meta information on the transaction
         * @type {Map<any,any>}
         */
        this.meta = new Map();
        /**
         * Whether this change originates from this doc.
         * @type {boolean}
         */
        this.local = local;
        /**
         * @type {Set<Doc>}
         */
        this.subdocsAdded = new Set();
        /**
         * @type {Set<Doc>}
         */
        this.subdocsRemoved = new Set();
        /**
         * @type {Set<Doc>}
         */
        this.subdocsLoaded = new Set();
      }
    }

    /**
     * @param {AbstractUpdateEncoder} encoder
     * @param {Transaction} transaction
     * @return {boolean} Whether data was written.
     */
    const writeUpdateMessageFromTransaction = (encoder, transaction) => {
      if (transaction.deleteSet.clients.size === 0 && !any(transaction.afterState, (clock, client) => transaction.beforeState.get(client) !== clock)) {
        return false
      }
      sortAndMergeDeleteSet(transaction.deleteSet);
      writeStructsFromTransaction(encoder, transaction);
      writeDeleteSet(encoder, transaction.deleteSet);
      return true
    };

    /**
     * If `type.parent` was added in current transaction, `type` technically
     * did not change, it was just added and we should not fire events for `type`.
     *
     * @param {Transaction} transaction
     * @param {AbstractType<YEvent>} type
     * @param {string|null} parentSub
     */
    const addChangedTypeToTransaction = (transaction, type, parentSub) => {
      const item = type._item;
      if (item === null || (item.id.clock < (transaction.beforeState.get(item.id.client) || 0) && !item.deleted)) {
        setIfUndefined(transaction.changed, type, create$1).add(parentSub);
      }
    };

    /**
     * @param {Array<AbstractStruct>} structs
     * @param {number} pos
     */
    const tryToMergeWithLeft = (structs, pos) => {
      const left = structs[pos - 1];
      const right = structs[pos];
      if (left.deleted === right.deleted && left.constructor === right.constructor) {
        if (left.mergeWith(right)) {
          structs.splice(pos, 1);
          if (right instanceof Item && right.parentSub !== null && /** @type {AbstractType<any>} */ (right.parent)._map.get(right.parentSub) === right) {
            /** @type {AbstractType<any>} */ (right.parent)._map.set(right.parentSub, /** @type {Item} */ (left));
          }
        }
      }
    };

    /**
     * @param {DeleteSet} ds
     * @param {StructStore} store
     * @param {function(Item):boolean} gcFilter
     */
    const tryGcDeleteSet = (ds, store, gcFilter) => {
      for (const [client, deleteItems] of ds.clients.entries()) {
        const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
        for (let di = deleteItems.length - 1; di >= 0; di--) {
          const deleteItem = deleteItems[di];
          const endDeleteItemClock = deleteItem.clock + deleteItem.len;
          for (
            let si = findIndexSS(structs, deleteItem.clock), struct = structs[si];
            si < structs.length && struct.id.clock < endDeleteItemClock;
            struct = structs[++si]
          ) {
            const struct = structs[si];
            if (deleteItem.clock + deleteItem.len <= struct.id.clock) {
              break
            }
            if (struct instanceof Item && struct.deleted && !struct.keep && gcFilter(struct)) {
              struct.gc(store, false);
            }
          }
        }
      }
    };

    /**
     * @param {DeleteSet} ds
     * @param {StructStore} store
     */
    const tryMergeDeleteSet = (ds, store) => {
      // try to merge deleted / gc'd items
      // merge from right to left for better efficiecy and so we don't miss any merge targets
      ds.clients.forEach((deleteItems, client) => {
        const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
        for (let di = deleteItems.length - 1; di >= 0; di--) {
          const deleteItem = deleteItems[di];
          // start with merging the item next to the last deleted item
          const mostRightIndexToCheck = min(structs.length - 1, 1 + findIndexSS(structs, deleteItem.clock + deleteItem.len - 1));
          for (
            let si = mostRightIndexToCheck, struct = structs[si];
            si > 0 && struct.id.clock >= deleteItem.clock;
            struct = structs[--si]
          ) {
            tryToMergeWithLeft(structs, si);
          }
        }
      });
    };

    /**
     * @param {DeleteSet} ds
     * @param {StructStore} store
     * @param {function(Item):boolean} gcFilter
     */
    const tryGc = (ds, store, gcFilter) => {
      tryGcDeleteSet(ds, store, gcFilter);
      tryMergeDeleteSet(ds, store);
    };

    /**
     * @param {Array<Transaction>} transactionCleanups
     * @param {number} i
     */
    const cleanupTransactions = (transactionCleanups, i) => {
      if (i < transactionCleanups.length) {
        const transaction = transactionCleanups[i];
        const doc = transaction.doc;
        const store = doc.store;
        const ds = transaction.deleteSet;
        const mergeStructs = transaction._mergeStructs;
        try {
          sortAndMergeDeleteSet(ds);
          transaction.afterState = getStateVector(transaction.doc.store);
          doc._transaction = null;
          doc.emit('beforeObserverCalls', [transaction, doc]);
          /**
           * An array of event callbacks.
           *
           * Each callback is called even if the other ones throw errors.
           *
           * @type {Array<function():void>}
           */
          const fs = [];
          // observe events on changed types
          transaction.changed.forEach((subs, itemtype) =>
            fs.push(() => {
              if (itemtype._item === null || !itemtype._item.deleted) {
                itemtype._callObserver(transaction, subs);
              }
            })
          );
          fs.push(() => {
            // deep observe events
            transaction.changedParentTypes.forEach((events, type) =>
              fs.push(() => {
                // We need to think about the possibility that the user transforms the
                // Y.Doc in the event.
                if (type._item === null || !type._item.deleted) {
                  events = events
                    .filter(event =>
                      event.target._item === null || !event.target._item.deleted
                    );
                  events
                    .forEach(event => {
                      event.currentTarget = type;
                    });
                  // We don't need to check for events.length
                  // because we know it has at least one element
                  callEventHandlerListeners(type._dEH, events, transaction);
                }
              })
            );
            fs.push(() => doc.emit('afterTransaction', [transaction, doc]));
          });
          callAll(fs, []);
        } finally {
          // Replace deleted items with ItemDeleted / GC.
          // This is where content is actually remove from the Yjs Doc.
          if (doc.gc) {
            tryGcDeleteSet(ds, store, doc.gcFilter);
          }
          tryMergeDeleteSet(ds, store);

          // on all affected store.clients props, try to merge
          transaction.afterState.forEach((clock, client) => {
            const beforeClock = transaction.beforeState.get(client) || 0;
            if (beforeClock !== clock) {
              const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
              // we iterate from right to left so we can safely remove entries
              const firstChangePos = max(findIndexSS(structs, beforeClock), 1);
              for (let i = structs.length - 1; i >= firstChangePos; i--) {
                tryToMergeWithLeft(structs, i);
              }
            }
          });
          // try to merge mergeStructs
          // @todo: it makes more sense to transform mergeStructs to a DS, sort it, and merge from right to left
          //        but at the moment DS does not handle duplicates
          for (let i = 0; i < mergeStructs.length; i++) {
            const { client, clock } = mergeStructs[i].id;
            const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
            const replacedStructPos = findIndexSS(structs, clock);
            if (replacedStructPos + 1 < structs.length) {
              tryToMergeWithLeft(structs, replacedStructPos + 1);
            }
            if (replacedStructPos > 0) {
              tryToMergeWithLeft(structs, replacedStructPos);
            }
          }
          if (!transaction.local && transaction.afterState.get(doc.clientID) !== transaction.beforeState.get(doc.clientID)) {
            doc.clientID = generateNewClientId();
            print(ORANGE, BOLD, '[yjs] ', UNBOLD, RED, 'Changed the client-id because another client seems to be using it.');
          }
          // @todo Merge all the transactions into one and provide send the data as a single update message
          doc.emit('afterTransactionCleanup', [transaction, doc]);
          if (doc._observers.has('update')) {
            const encoder = new DefaultUpdateEncoder();
            const hasContent = writeUpdateMessageFromTransaction(encoder, transaction);
            if (hasContent) {
              doc.emit('update', [encoder.toUint8Array(), transaction.origin, doc]);
            }
          }
          if (doc._observers.has('updateV2')) {
            const encoder = new UpdateEncoderV2();
            const hasContent = writeUpdateMessageFromTransaction(encoder, transaction);
            if (hasContent) {
              doc.emit('updateV2', [encoder.toUint8Array(), transaction.origin, doc]);
            }
          }
          transaction.subdocsAdded.forEach(subdoc => doc.subdocs.add(subdoc));
          transaction.subdocsRemoved.forEach(subdoc => doc.subdocs.delete(subdoc));

          doc.emit('subdocs', [{ loaded: transaction.subdocsLoaded, added: transaction.subdocsAdded, removed: transaction.subdocsRemoved }]);
          transaction.subdocsRemoved.forEach(subdoc => subdoc.destroy());

          if (transactionCleanups.length <= i + 1) {
            doc._transactionCleanups = [];
            doc.emit('afterAllTransactions', [doc, transactionCleanups]);
          } else {
            cleanupTransactions(transactionCleanups, i + 1);
          }
        }
      }
    };

    /**
     * Implements the functionality of `y.transact(()=>{..})`
     *
     * @param {Doc} doc
     * @param {function(Transaction):void} f
     * @param {any} [origin=true]
     *
     * @function
     */
    const transact = (doc, f, origin = null, local = true) => {
      const transactionCleanups = doc._transactionCleanups;
      let initialCall = false;
      if (doc._transaction === null) {
        initialCall = true;
        doc._transaction = new Transaction(doc, origin, local);
        transactionCleanups.push(doc._transaction);
        if (transactionCleanups.length === 1) {
          doc.emit('beforeAllTransactions', [doc]);
        }
        doc.emit('beforeTransaction', [doc._transaction, doc]);
      }
      try {
        f(doc._transaction);
      } finally {
        if (initialCall && transactionCleanups[0] === doc._transaction) {
          // The first transaction ended, now process observer calls.
          // Observer call may create new transactions for which we need to call the observers and do cleanup.
          // We don't want to nest these calls, so we execute these calls one after
          // another.
          // Also we need to ensure that all cleanups are called, even if the
          // observes throw errors.
          // This file is full of hacky try {} finally {} blocks to ensure that an
          // event can throw errors and also that the cleanup is called.
          cleanupTransactions(transactionCleanups, 0);
        }
      }
    };

    class StackItem {
      /**
       * @param {DeleteSet} ds
       * @param {Map<number,number>} beforeState
       * @param {Map<number,number>} afterState
       */
      constructor (ds, beforeState, afterState) {
        this.ds = ds;
        this.beforeState = beforeState;
        this.afterState = afterState;
        /**
         * Use this to save and restore metadata like selection range
         */
        this.meta = new Map();
      }
    }

    /**
     * @param {UndoManager} undoManager
     * @param {Array<StackItem>} stack
     * @param {string} eventType
     * @return {StackItem?}
     */
    const popStackItem = (undoManager, stack, eventType) => {
      /**
       * Whether a change happened
       * @type {StackItem?}
       */
      let result = null;
      const doc = undoManager.doc;
      const scope = undoManager.scope;
      transact(doc, transaction => {
        while (stack.length > 0 && result === null) {
          const store = doc.store;
          const stackItem = /** @type {StackItem} */ (stack.pop());
          /**
           * @type {Set<Item>}
           */
          const itemsToRedo = new Set();
          /**
           * @type {Array<Item>}
           */
          const itemsToDelete = [];
          let performedChange = false;
          stackItem.afterState.forEach((endClock, client) => {
            const startClock = stackItem.beforeState.get(client) || 0;
            const len = endClock - startClock;
            // @todo iterateStructs should not need the structs parameter
            const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client));
            if (startClock !== endClock) {
              // make sure structs don't overlap with the range of created operations [stackItem.start, stackItem.start + stackItem.end)
              // this must be executed before deleted structs are iterated.
              getItemCleanStart(transaction, createID(client, startClock));
              if (endClock < getState(doc.store, client)) {
                getItemCleanStart(transaction, createID(client, endClock));
              }
              iterateStructs(transaction, structs, startClock, len, struct => {
                if (struct instanceof Item) {
                  if (struct.redone !== null) {
                    let { item, diff } = followRedone(store, struct.id);
                    if (diff > 0) {
                      item = getItemCleanStart(transaction, createID(item.id.client, item.id.clock + diff));
                    }
                    if (item.length > len) {
                      getItemCleanStart(transaction, createID(item.id.client, endClock));
                    }
                    struct = item;
                  }
                  if (!struct.deleted && scope.some(type => isParentOf(type, /** @type {Item} */ (struct)))) {
                    itemsToDelete.push(struct);
                  }
                }
              });
            }
          });
          iterateDeletedStructs(transaction, stackItem.ds, struct => {
            const id = struct.id;
            const clock = id.clock;
            const client = id.client;
            const startClock = stackItem.beforeState.get(client) || 0;
            const endClock = stackItem.afterState.get(client) || 0;
            if (
              struct instanceof Item &&
              scope.some(type => isParentOf(type, struct)) &&
              // Never redo structs in [stackItem.start, stackItem.start + stackItem.end) because they were created and deleted in the same capture interval.
              !(clock >= startClock && clock < endClock)
            ) {
              itemsToRedo.add(struct);
            }
          });
          itemsToRedo.forEach(struct => {
            performedChange = redoItem(transaction, struct, itemsToRedo) !== null || performedChange;
          });
          // We want to delete in reverse order so that children are deleted before
          // parents, so we have more information available when items are filtered.
          for (let i = itemsToDelete.length - 1; i >= 0; i--) {
            const item = itemsToDelete[i];
            if (undoManager.deleteFilter(item)) {
              item.delete(transaction);
              performedChange = true;
            }
          }
          result = stackItem;
          if (result != null) {
            undoManager.emit('stack-item-popped', [{ stackItem: result, type: eventType }, undoManager]);
          }
        }
        transaction.changed.forEach((subProps, type) => {
          // destroy search marker if necessary
          if (subProps.has(null) && type._searchMarker) {
            type._searchMarker.length = 0;
          }
        });
      }, undoManager);
      return result
    };

    /**
     * @typedef {Object} UndoManagerOptions
     * @property {number} [UndoManagerOptions.captureTimeout=500]
     * @property {function(Item):boolean} [UndoManagerOptions.deleteFilter=()=>true] Sometimes
     * it is necessary to filter whan an Undo/Redo operation can delete. If this
     * filter returns false, the type/item won't be deleted even it is in the
     * undo/redo scope.
     * @property {Set<any>} [UndoManagerOptions.trackedOrigins=new Set([null])]
     */

    /**
     * Fires 'stack-item-added' event when a stack item was added to either the undo- or
     * the redo-stack. You may store additional stack information via the
     * metadata property on `event.stackItem.meta` (it is a `Map` of metadata properties).
     * Fires 'stack-item-popped' event when a stack item was popped from either the
     * undo- or the redo-stack. You may restore the saved stack information from `event.stackItem.meta`.
     *
     * @extends {Observable<'stack-item-added'|'stack-item-popped'>}
     */
    class UndoManager extends Observable {
      /**
       * @param {AbstractType<any>|Array<AbstractType<any>>} typeScope Accepts either a single type, or an array of types
       * @param {UndoManagerOptions} options
       */
      constructor (typeScope, { captureTimeout = 500, deleteFilter = () => true, trackedOrigins = new Set([null]) } = {}) {
        super();
        this.scope = typeScope instanceof Array ? typeScope : [typeScope];
        this.deleteFilter = deleteFilter;
        trackedOrigins.add(this);
        this.trackedOrigins = trackedOrigins;
        /**
         * @type {Array<StackItem>}
         */
        this.undoStack = [];
        /**
         * @type {Array<StackItem>}
         */
        this.redoStack = [];
        /**
         * Whether the client is currently undoing (calling UndoManager.undo)
         *
         * @type {boolean}
         */
        this.undoing = false;
        this.redoing = false;
        this.doc = /** @type {Doc} */ (this.scope[0].doc);
        this.lastChange = 0;
        this.doc.on('afterTransaction', /** @param {Transaction} transaction */ transaction => {
          // Only track certain transactions
          if (!this.scope.some(type => transaction.changedParentTypes.has(type)) || (!this.trackedOrigins.has(transaction.origin) && (!transaction.origin || !this.trackedOrigins.has(transaction.origin.constructor)))) {
            return
          }
          const undoing = this.undoing;
          const redoing = this.redoing;
          const stack = undoing ? this.redoStack : this.undoStack;
          if (undoing) {
            this.stopCapturing(); // next undo should not be appended to last stack item
          } else if (!redoing) {
            // neither undoing nor redoing: delete redoStack
            this.redoStack = [];
          }
          const beforeState = transaction.beforeState;
          const afterState = transaction.afterState;
          const now = getUnixTime();
          if (now - this.lastChange < captureTimeout && stack.length > 0 && !undoing && !redoing) {
            // append change to last stack op
            const lastOp = stack[stack.length - 1];
            lastOp.ds = mergeDeleteSets([lastOp.ds, transaction.deleteSet]);
            lastOp.afterState = afterState;
          } else {
            // create a new stack op
            stack.push(new StackItem(transaction.deleteSet, beforeState, afterState));
          }
          if (!undoing && !redoing) {
            this.lastChange = now;
          }
          // make sure that deleted structs are not gc'd
          iterateDeletedStructs(transaction, transaction.deleteSet, /** @param {Item|GC} item */ item => {
            if (item instanceof Item && this.scope.some(type => isParentOf(type, item))) {
              keepItem(item, true);
            }
          });
          this.emit('stack-item-added', [{ stackItem: stack[stack.length - 1], origin: transaction.origin, type: undoing ? 'redo' : 'undo' }, this]);
        });
      }

      clear () {
        this.doc.transact(transaction => {
          /**
           * @param {StackItem} stackItem
           */
          const clearItem = stackItem => {
            iterateDeletedStructs(transaction, stackItem.ds, item => {
              if (item instanceof Item && this.scope.some(type => isParentOf(type, item))) {
                keepItem(item, false);
              }
            });
          };
          this.undoStack.forEach(clearItem);
          this.redoStack.forEach(clearItem);
        });
        this.undoStack = [];
        this.redoStack = [];
      }

      /**
       * UndoManager merges Undo-StackItem if they are created within time-gap
       * smaller than `options.captureTimeout`. Call `um.stopCapturing()` so that the next
       * StackItem won't be merged.
       *
       *
       * @example
       *     // without stopCapturing
       *     ytext.insert(0, 'a')
       *     ytext.insert(1, 'b')
       *     um.undo()
       *     ytext.toString() // => '' (note that 'ab' was removed)
       *     // with stopCapturing
       *     ytext.insert(0, 'a')
       *     um.stopCapturing()
       *     ytext.insert(0, 'b')
       *     um.undo()
       *     ytext.toString() // => 'a' (note that only 'b' was removed)
       *
       */
      stopCapturing () {
        this.lastChange = 0;
      }

      /**
       * Undo last changes on type.
       *
       * @return {StackItem?} Returns StackItem if a change was applied
       */
      undo () {
        this.undoing = true;
        let res;
        try {
          res = popStackItem(this, this.undoStack, 'undo');
        } finally {
          this.undoing = false;
        }
        return res
      }

      /**
       * Redo last undo operation.
       *
       * @return {StackItem?} Returns StackItem if a change was applied
       */
      redo () {
        this.redoing = true;
        let res;
        try {
          res = popStackItem(this, this.redoStack, 'redo');
        } finally {
          this.redoing = false;
        }
        return res
      }
    }

    /**
     * YEvent describes the changes on a YType.
     */
    class YEvent {
      /**
       * @param {AbstractType<any>} target The changed type.
       * @param {Transaction} transaction
       */
      constructor (target, transaction) {
        /**
         * The type on which this event was created on.
         * @type {AbstractType<any>}
         */
        this.target = target;
        /**
         * The current target on which the observe callback is called.
         * @type {AbstractType<any>}
         */
        this.currentTarget = target;
        /**
         * The transaction that triggered this event.
         * @type {Transaction}
         */
        this.transaction = transaction;
        /**
         * @type {Object|null}
         */
        this._changes = null;
      }

      /**
       * Computes the path from `y` to the changed type.
       *
       * The following property holds:
       * @example
       *   let type = y
       *   event.path.forEach(dir => {
       *     type = type.get(dir)
       *   })
       *   type === event.target // => true
       */
      get path () {
        // @ts-ignore _item is defined because target is integrated
        return getPathTo(this.currentTarget, this.target)
      }

      /**
       * Check if a struct is deleted by this event.
       *
       * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
       *
       * @param {AbstractStruct} struct
       * @return {boolean}
       */
      deletes (struct) {
        return isDeleted(this.transaction.deleteSet, struct.id)
      }

      /**
       * Check if a struct is added by this event.
       *
       * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
       *
       * @param {AbstractStruct} struct
       * @return {boolean}
       */
      adds (struct) {
        return struct.id.clock >= (this.transaction.beforeState.get(struct.id.client) || 0)
      }

      /**
       * @return {{added:Set<Item>,deleted:Set<Item>,keys:Map<string,{action:'add'|'update'|'delete',oldValue:any}>,delta:Array<{insert:Array<any>}|{delete:number}|{retain:number}>}}
       */
      get changes () {
        let changes = this._changes;
        if (changes === null) {
          const target = this.target;
          const added = create$1();
          const deleted = create$1();
          /**
           * @type {Array<{insert:Array<any>}|{delete:number}|{retain:number}>}
           */
          const delta = [];
          /**
           * @type {Map<string,{ action: 'add' | 'update' | 'delete', oldValue: any}>}
           */
          const keys = new Map();
          changes = {
            added, deleted, delta, keys
          };
          const changed = /** @type Set<string|null> */ (this.transaction.changed.get(target));
          if (changed.has(null)) {
            /**
             * @type {any}
             */
            let lastOp = null;
            const packOp = () => {
              if (lastOp) {
                delta.push(lastOp);
              }
            };
            for (let item = target._start; item !== null; item = item.right) {
              if (item.deleted) {
                if (this.deletes(item) && !this.adds(item)) {
                  if (lastOp === null || lastOp.delete === undefined) {
                    packOp();
                    lastOp = { delete: 0 };
                  }
                  lastOp.delete += item.length;
                  deleted.add(item);
                } // else nop
              } else {
                if (this.adds(item)) {
                  if (lastOp === null || lastOp.insert === undefined) {
                    packOp();
                    lastOp = { insert: [] };
                  }
                  lastOp.insert = lastOp.insert.concat(item.content.getContent());
                  added.add(item);
                } else {
                  if (lastOp === null || lastOp.retain === undefined) {
                    packOp();
                    lastOp = { retain: 0 };
                  }
                  lastOp.retain += item.length;
                }
              }
            }
            if (lastOp !== null && lastOp.retain === undefined) {
              packOp();
            }
          }
          changed.forEach(key => {
            if (key !== null) {
              const item = /** @type {Item} */ (target._map.get(key));
              /**
               * @type {'delete' | 'add' | 'update'}
               */
              let action;
              let oldValue;
              if (this.adds(item)) {
                let prev = item.left;
                while (prev !== null && this.adds(prev)) {
                  prev = prev.left;
                }
                if (this.deletes(item)) {
                  if (prev !== null && this.deletes(prev)) {
                    action = 'delete';
                    oldValue = last(prev.content.getContent());
                  } else {
                    return
                  }
                } else {
                  if (prev !== null && this.deletes(prev)) {
                    action = 'update';
                    oldValue = last(prev.content.getContent());
                  } else {
                    action = 'add';
                    oldValue = undefined;
                  }
                }
              } else {
                if (this.deletes(item)) {
                  action = 'delete';
                  oldValue = last(/** @type {Item} */ item.content.getContent());
                } else {
                  return // nop
                }
              }
              keys.set(key, { action, oldValue });
            }
          });
          this._changes = changes;
        }
        return /** @type {any} */ (changes)
      }
    }

    /**
     * Compute the path from this type to the specified target.
     *
     * @example
     *   // `child` should be accessible via `type.get(path[0]).get(path[1])..`
     *   const path = type.getPathTo(child)
     *   // assuming `type instanceof YArray`
     *   console.log(path) // might look like => [2, 'key1']
     *   child === type.get(path[0]).get(path[1])
     *
     * @param {AbstractType<any>} parent
     * @param {AbstractType<any>} child target
     * @return {Array<string|number>} Path to the target
     *
     * @private
     * @function
     */
    const getPathTo = (parent, child) => {
      const path = [];
      while (child._item !== null && child !== parent) {
        if (child._item.parentSub !== null) {
          // parent is map-ish
          path.unshift(child._item.parentSub);
        } else {
          // parent is array-ish
          let i = 0;
          let c = /** @type {AbstractType<any>} */ (child._item.parent)._start;
          while (c !== child._item && c !== null) {
            if (!c.deleted) {
              i++;
            }
            c = c.right;
          }
          path.unshift(i);
        }
        child = /** @type {AbstractType<any>} */ (child._item.parent);
      }
      return path
    };

    const maxSearchMarker = 80;

    /**
     * A unique timestamp that identifies each marker.
     *
     * Time is relative,.. this is more like an ever-increasing clock.
     *
     * @type {number}
     */
    let globalSearchMarkerTimestamp = 0;

    class ArraySearchMarker {
      /**
       * @param {Item} p
       * @param {number} index
       */
      constructor (p, index) {
        p.marker = true;
        this.p = p;
        this.index = index;
        this.timestamp = globalSearchMarkerTimestamp++;
      }
    }

    /**
     * @param {ArraySearchMarker} marker
     */
    const refreshMarkerTimestamp = marker => { marker.timestamp = globalSearchMarkerTimestamp++; };

    /**
     * This is rather complex so this function is the only thing that should overwrite a marker
     *
     * @param {ArraySearchMarker} marker
     * @param {Item} p
     * @param {number} index
     */
    const overwriteMarker = (marker, p, index) => {
      marker.p.marker = false;
      marker.p = p;
      p.marker = true;
      marker.index = index;
      marker.timestamp = globalSearchMarkerTimestamp++;
    };

    /**
     * @param {Array<ArraySearchMarker>} searchMarker
     * @param {Item} p
     * @param {number} index
     */
    const markPosition = (searchMarker, p, index) => {
      if (searchMarker.length >= maxSearchMarker) {
        // override oldest marker (we don't want to create more objects)
        const marker = searchMarker.reduce((a, b) => a.timestamp < b.timestamp ? a : b);
        overwriteMarker(marker, p, index);
        return marker
      } else {
        // create new marker
        const pm = new ArraySearchMarker(p, index);
        searchMarker.push(pm);
        return pm
      }
    };

    /**
     * Search marker help us to find positions in the associative array faster.
     *
     * They speed up the process of finding a position without much bookkeeping.
     *
     * A maximum of `maxSearchMarker` objects are created.
     *
     * This function always returns a refreshed marker (updated timestamp)
     *
     * @param {AbstractType<any>} yarray
     * @param {number} index
     */
    const findMarker = (yarray, index) => {
      if (yarray._start === null || index === 0 || yarray._searchMarker === null) {
        return null
      }
      const marker = yarray._searchMarker.length === 0 ? null : yarray._searchMarker.reduce((a, b) => abs(index - a.index) < abs(index - b.index) ? a : b);
      let p = yarray._start;
      let pindex = 0;
      if (marker !== null) {
        p = marker.p;
        pindex = marker.index;
        refreshMarkerTimestamp(marker); // we used it, we might need to use it again
      }
      // iterate to right if possible
      while (p.right !== null && pindex < index) {
        if (!p.deleted && p.countable) {
          if (index < pindex + p.length) {
            break
          }
          pindex += p.length;
        }
        p = p.right;
      }
      // iterate to left if necessary (might be that pindex > index)
      while (p.left !== null && pindex > index) {
        p = p.left;
        if (!p.deleted && p.countable) {
          pindex -= p.length;
        }
      }
      // we want to make sure that p can't be merged with left, because that would screw up everything
      // in that cas just return what we have (it is most likely the best marker anyway)
      // iterate to left until p can't be merged with left
      while (p.left !== null && p.left.id.client === p.id.client && p.left.id.clock + p.left.length === p.id.clock) {
        p = p.left;
        if (!p.deleted && p.countable) {
          pindex -= p.length;
        }
      }

      // @todo remove!
      // assure position
      // {
      //   let start = yarray._start
      //   let pos = 0
      //   while (start !== p) {
      //     if (!start.deleted && start.countable) {
      //       pos += start.length
      //     }
      //     start = /** @type {Item} */ (start.right)
      //   }
      //   if (pos !== pindex) {
      //     debugger
      //     throw new Error('Gotcha position fail!')
      //   }
      // }
      // if (marker) {
      //   if (window.lengthes == null) {
      //     window.lengthes = []
      //     window.getLengthes = () => window.lengthes.sort((a, b) => a - b)
      //   }
      //   window.lengthes.push(marker.index - pindex)
      //   console.log('distance', marker.index - pindex, 'len', p && p.parent.length)
      // }
      if (marker !== null && abs(marker.index - pindex) < /** @type {YText|YArray<any>} */ (p.parent).length / maxSearchMarker) {
        // adjust existing marker
        overwriteMarker(marker, p, pindex);
        return marker
      } else {
        // create new marker
        return markPosition(yarray._searchMarker, p, pindex)
      }
    };

    /**
     * Update markers when a change happened.
     *
     * This should be called before doing a deletion!
     *
     * @param {Array<ArraySearchMarker>} searchMarker
     * @param {number} index
     * @param {number} len If insertion, len is positive. If deletion, len is negative.
     */
    const updateMarkerChanges = (searchMarker, index, len) => {
      for (let i = searchMarker.length - 1; i >= 0; i--) {
        const m = searchMarker[i];
        if (len > 0) {
          /**
           * @type {Item|null}
           */
          let p = m.p;
          p.marker = false;
          // Ideally we just want to do a simple position comparison, but this will only work if
          // search markers don't point to deleted items for formats.
          // Iterate marker to prev undeleted countable position so we know what to do when updating a position
          while (p && (p.deleted || !p.countable)) {
            p = p.left;
            if (p && !p.deleted && p.countable) {
              // adjust position. the loop should break now
              m.index -= p.length;
            }
          }
          if (p === null || p.marker === true) {
            // remove search marker if updated position is null or if position is already marked
            searchMarker.splice(i, 1);
            continue
          }
          m.p = p;
          p.marker = true;
        }
        if (index < m.index || (len > 0 && index === m.index)) { // a simple index <= m.index check would actually suffice
          m.index = max(index, m.index + len);
        }
      }
    };

    /**
     * Accumulate all (list) children of a type and return them as an Array.
     *
     * @param {AbstractType<any>} t
     * @return {Array<Item>}
     */
    const getTypeChildren = t => {
      let s = t._start;
      const arr = [];
      while (s) {
        arr.push(s);
        s = s.right;
      }
      return arr
    };

    /**
     * Call event listeners with an event. This will also add an event to all
     * parents (for `.observeDeep` handlers).
     *
     * @template EventType
     * @param {AbstractType<EventType>} type
     * @param {Transaction} transaction
     * @param {EventType} event
     */
    const callTypeObservers = (type, transaction, event) => {
      const changedType = type;
      const changedParentTypes = transaction.changedParentTypes;
      while (true) {
        // @ts-ignore
        setIfUndefined(changedParentTypes, type, () => []).push(event);
        if (type._item === null) {
          break
        }
        type = /** @type {AbstractType<any>} */ (type._item.parent);
      }
      callEventHandlerListeners(changedType._eH, event, transaction);
    };

    /**
     * @template EventType
     * Abstract Yjs Type class
     */
    class AbstractType {
      constructor () {
        /**
         * @type {Item|null}
         */
        this._item = null;
        /**
         * @type {Map<string,Item>}
         */
        this._map = new Map();
        /**
         * @type {Item|null}
         */
        this._start = null;
        /**
         * @type {Doc|null}
         */
        this.doc = null;
        this._length = 0;
        /**
         * Event handlers
         * @type {EventHandler<EventType,Transaction>}
         */
        this._eH = createEventHandler();
        /**
         * Deep event handlers
         * @type {EventHandler<Array<YEvent>,Transaction>}
         */
        this._dEH = createEventHandler();
        /**
         * @type {null | Array<ArraySearchMarker>}
         */
        this._searchMarker = null;
      }

      /**
       * Integrate this type into the Yjs instance.
       *
       * * Save this struct in the os
       * * This type is sent to other client
       * * Observer functions are fired
       *
       * @param {Doc} y The Yjs instance
       * @param {Item|null} item
       */
      _integrate (y, item) {
        this.doc = y;
        this._item = item;
      }

      /**
       * @return {AbstractType<EventType>}
       */
      _copy () {
        throw methodUnimplemented()
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       */
      _write (encoder) { }

      /**
       * The first non-deleted item
       */
      get _first () {
        let n = this._start;
        while (n !== null && n.deleted) {
          n = n.right;
        }
        return n
      }

      /**
       * Creates YEvent and calls all type observers.
       * Must be implemented by each type.
       *
       * @param {Transaction} transaction
       * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
       */
      _callObserver (transaction, parentSubs) {
        if (!transaction.local && this._searchMarker) {
          this._searchMarker.length = 0;
        }
      }

      /**
       * Observe all events that are created on this type.
       *
       * @param {function(EventType, Transaction):void} f Observer function
       */
      observe (f) {
        addEventHandlerListener(this._eH, f);
      }

      /**
       * Observe all events that are created by this type and its children.
       *
       * @param {function(Array<YEvent>,Transaction):void} f Observer function
       */
      observeDeep (f) {
        addEventHandlerListener(this._dEH, f);
      }

      /**
       * Unregister an observer function.
       *
       * @param {function(EventType,Transaction):void} f Observer function
       */
      unobserve (f) {
        removeEventHandlerListener(this._eH, f);
      }

      /**
       * Unregister an observer function.
       *
       * @param {function(Array<YEvent>,Transaction):void} f Observer function
       */
      unobserveDeep (f) {
        removeEventHandlerListener(this._dEH, f);
      }

      /**
       * @abstract
       * @return {any}
       */
      toJSON () {}
    }

    /**
     * @param {AbstractType<any>} type
     * @return {Array<any>}
     *
     * @private
     * @function
     */
    const typeListToArray = type => {
      const cs = [];
      let n = type._start;
      while (n !== null) {
        if (n.countable && !n.deleted) {
          const c = n.content.getContent();
          for (let i = 0; i < c.length; i++) {
            cs.push(c[i]);
          }
        }
        n = n.right;
      }
      return cs
    };

    /**
     * @param {AbstractType<any>} type
     * @param {Snapshot} snapshot
     * @return {Array<any>}
     *
     * @private
     * @function
     */
    const typeListToArraySnapshot = (type, snapshot) => {
      const cs = [];
      let n = type._start;
      while (n !== null) {
        if (n.countable && isVisible(n, snapshot)) {
          const c = n.content.getContent();
          for (let i = 0; i < c.length; i++) {
            cs.push(c[i]);
          }
        }
        n = n.right;
      }
      return cs
    };

    /**
     * Executes a provided function on once on overy element of this YArray.
     *
     * @param {AbstractType<any>} type
     * @param {function(any,number,any):void} f A function to execute on every element of this YArray.
     *
     * @private
     * @function
     */
    const typeListForEach = (type, f) => {
      let index = 0;
      let n = type._start;
      while (n !== null) {
        if (n.countable && !n.deleted) {
          const c = n.content.getContent();
          for (let i = 0; i < c.length; i++) {
            f(c[i], index++, type);
          }
        }
        n = n.right;
      }
    };

    /**
     * @template C,R
     * @param {AbstractType<any>} type
     * @param {function(C,number,AbstractType<any>):R} f
     * @return {Array<R>}
     *
     * @private
     * @function
     */
    const typeListMap = (type, f) => {
      /**
       * @type {Array<any>}
       */
      const result = [];
      typeListForEach(type, (c, i) => {
        result.push(f(c, i, type));
      });
      return result
    };

    /**
     * @param {AbstractType<any>} type
     * @return {IterableIterator<any>}
     *
     * @private
     * @function
     */
    const typeListCreateIterator = type => {
      let n = type._start;
      /**
       * @type {Array<any>|null}
       */
      let currentContent = null;
      let currentContentIndex = 0;
      return {
        [Symbol.iterator] () {
          return this
        },
        next: () => {
          // find some content
          if (currentContent === null) {
            while (n !== null && n.deleted) {
              n = n.right;
            }
            // check if we reached the end, no need to check currentContent, because it does not exist
            if (n === null) {
              return {
                done: true,
                value: undefined
              }
            }
            // we found n, so we can set currentContent
            currentContent = n.content.getContent();
            currentContentIndex = 0;
            n = n.right; // we used the content of n, now iterate to next
          }
          const value = currentContent[currentContentIndex++];
          // check if we need to empty currentContent
          if (currentContent.length <= currentContentIndex) {
            currentContent = null;
          }
          return {
            done: false,
            value
          }
        }
      }
    };

    /**
     * @param {AbstractType<any>} type
     * @param {number} index
     * @return {any}
     *
     * @private
     * @function
     */
    const typeListGet = (type, index) => {
      const marker = findMarker(type, index);
      let n = type._start;
      if (marker !== null) {
        n = marker.p;
        index -= marker.index;
      }
      for (; n !== null; n = n.right) {
        if (!n.deleted && n.countable) {
          if (index < n.length) {
            return n.content.getContent()[index]
          }
          index -= n.length;
        }
      }
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {Item?} referenceItem
     * @param {Array<Object<string,any>|Array<any>|boolean|number|string|Uint8Array>} content
     *
     * @private
     * @function
     */
    const typeListInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
      let left = referenceItem;
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      const store = doc.store;
      const right = referenceItem === null ? parent._start : referenceItem.right;
      /**
       * @type {Array<Object|Array<any>|number>}
       */
      let jsonContent = [];
      const packJsonContent = () => {
        if (jsonContent.length > 0) {
          left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentAny(jsonContent));
          left.integrate(transaction, 0);
          jsonContent = [];
        }
      };
      content.forEach(c => {
        switch (c.constructor) {
          case Number:
          case Object:
          case Boolean:
          case Array:
          case String:
            jsonContent.push(c);
            break
          default:
            packJsonContent();
            switch (c.constructor) {
              case Uint8Array:
              case ArrayBuffer:
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentBinary(new Uint8Array(/** @type {Uint8Array} */ (c))));
                left.integrate(transaction, 0);
                break
              case Doc:
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentDoc(/** @type {Doc} */ (c)));
                left.integrate(transaction, 0);
                break
              default:
                if (c instanceof AbstractType) {
                  left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentType(c));
                  left.integrate(transaction, 0);
                } else {
                  throw new Error('Unexpected content type in insert operation')
                }
            }
        }
      });
      packJsonContent();
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {number} index
     * @param {Array<Object<string,any>|Array<any>|number|string|Uint8Array>} content
     *
     * @private
     * @function
     */
    const typeListInsertGenerics = (transaction, parent, index, content) => {
      if (index === 0) {
        if (parent._searchMarker) {
          updateMarkerChanges(parent._searchMarker, index, content.length);
        }
        return typeListInsertGenericsAfter(transaction, parent, null, content)
      }
      const startIndex = index;
      const marker = findMarker(parent, index);
      let n = parent._start;
      if (marker !== null) {
        n = marker.p;
        index -= marker.index;
        // we need to iterate one to the left so that the algorithm works
        if (index === 0) {
          // @todo refactor this as it actually doesn't consider formats
          n = n.prev; // important! get the left undeleted item so that we can actually decrease index
          index += (n && n.countable && !n.deleted) ? n.length : 0;
        }
      }
      for (; n !== null; n = n.right) {
        if (!n.deleted && n.countable) {
          if (index <= n.length) {
            if (index < n.length) {
              // insert in-between
              getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index));
            }
            break
          }
          index -= n.length;
        }
      }
      if (parent._searchMarker) {
        updateMarkerChanges(parent._searchMarker, startIndex, content.length);
      }
      return typeListInsertGenericsAfter(transaction, parent, n, content)
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {number} index
     * @param {number} length
     *
     * @private
     * @function
     */
    const typeListDelete = (transaction, parent, index, length) => {
      if (length === 0) { return }
      const startIndex = index;
      const startLength = length;
      const marker = findMarker(parent, index);
      let n = parent._start;
      if (marker !== null) {
        n = marker.p;
        index -= marker.index;
      }
      // compute the first item to be deleted
      for (; n !== null && index > 0; n = n.right) {
        if (!n.deleted && n.countable) {
          if (index < n.length) {
            getItemCleanStart(transaction, createID(n.id.client, n.id.clock + index));
          }
          index -= n.length;
        }
      }
      // delete all items until done
      while (length > 0 && n !== null) {
        if (!n.deleted) {
          if (length < n.length) {
            getItemCleanStart(transaction, createID(n.id.client, n.id.clock + length));
          }
          n.delete(transaction);
          length -= n.length;
        }
        n = n.right;
      }
      if (length > 0) {
        throw create$2('array length exceeded')
      }
      if (parent._searchMarker) {
        updateMarkerChanges(parent._searchMarker, startIndex, -startLength + length /* in case we remove the above exception */);
      }
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {string} key
     *
     * @private
     * @function
     */
    const typeMapDelete = (transaction, parent, key) => {
      const c = parent._map.get(key);
      if (c !== undefined) {
        c.delete(transaction);
      }
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {string} key
     * @param {Object|number|Array<any>|string|Uint8Array|AbstractType<any>} value
     *
     * @private
     * @function
     */
    const typeMapSet = (transaction, parent, key, value) => {
      const left = parent._map.get(key) || null;
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      let content;
      if (value == null) {
        content = new ContentAny([value]);
      } else {
        switch (value.constructor) {
          case Number:
          case Object:
          case Boolean:
          case Array:
          case String:
            content = new ContentAny([value]);
            break
          case Uint8Array:
            content = new ContentBinary(/** @type {Uint8Array} */ (value));
            break
          case Doc:
            content = new ContentDoc(/** @type {Doc} */ (value));
            break
          default:
            if (value instanceof AbstractType) {
              content = new ContentType(value);
            } else {
              throw new Error('Unexpected content type')
            }
        }
      }
      new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, null, null, parent, key, content).integrate(transaction, 0);
    };

    /**
     * @param {AbstractType<any>} parent
     * @param {string} key
     * @return {Object<string,any>|number|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
     *
     * @private
     * @function
     */
    const typeMapGet = (parent, key) => {
      const val = parent._map.get(key);
      return val !== undefined && !val.deleted ? val.content.getContent()[val.length - 1] : undefined
    };

    /**
     * @param {AbstractType<any>} parent
     * @return {Object<string,Object<string,any>|number|Array<any>|string|Uint8Array|AbstractType<any>|undefined>}
     *
     * @private
     * @function
     */
    const typeMapGetAll = (parent) => {
      /**
       * @type {Object<string,any>}
       */
      const res = {};
      parent._map.forEach((value, key) => {
        if (!value.deleted) {
          res[key] = value.content.getContent()[value.length - 1];
        }
      });
      return res
    };

    /**
     * @param {AbstractType<any>} parent
     * @param {string} key
     * @return {boolean}
     *
     * @private
     * @function
     */
    const typeMapHas = (parent, key) => {
      const val = parent._map.get(key);
      return val !== undefined && !val.deleted
    };

    /**
     * @param {AbstractType<any>} parent
     * @param {string} key
     * @param {Snapshot} snapshot
     * @return {Object<string,any>|number|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
     *
     * @private
     * @function
     */
    const typeMapGetSnapshot = (parent, key, snapshot) => {
      let v = parent._map.get(key) || null;
      while (v !== null && (!snapshot.sv.has(v.id.client) || v.id.clock >= (snapshot.sv.get(v.id.client) || 0))) {
        v = v.left;
      }
      return v !== null && isVisible(v, snapshot) ? v.content.getContent()[v.length - 1] : undefined
    };

    /**
     * @param {Map<string,Item>} map
     * @return {IterableIterator<Array<any>>}
     *
     * @private
     * @function
     */
    const createMapIterator = map => iteratorFilter(map.entries(), /** @param {any} entry */ entry => !entry[1].deleted);

    /**
     * @module YArray
     */

    /**
     * Event that describes the changes on a YArray
     * @template T
     */
    class YArrayEvent extends YEvent {
      /**
       * @param {YArray<T>} yarray The changed type
       * @param {Transaction} transaction The transaction object
       */
      constructor (yarray, transaction) {
        super(yarray, transaction);
        this._transaction = transaction;
      }
    }

    /**
     * A shared Array implementation.
     * @template T
     * @extends AbstractType<YArrayEvent<T>>
     * @implements {Iterable<T>}
     */
    class YArray extends AbstractType {
      constructor () {
        super();
        /**
         * @type {Array<any>?}
         * @private
         */
        this._prelimContent = [];
        /**
         * @type {Array<ArraySearchMarker>}
         */
        this._searchMarker = [];
      }

      /**
       * Integrate this type into the Yjs instance.
       *
       * * Save this struct in the os
       * * This type is sent to other client
       * * Observer functions are fired
       *
       * @param {Doc} y The Yjs instance
       * @param {Item} item
       */
      _integrate (y, item) {
        super._integrate(y, item);
        this.insert(0, /** @type {Array<any>} */ (this._prelimContent));
        this._prelimContent = null;
      }

      _copy () {
        return new YArray()
      }

      get length () {
        return this._prelimContent === null ? this._length : this._prelimContent.length
      }

      /**
       * Creates YArrayEvent and calls observers.
       *
       * @param {Transaction} transaction
       * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
       */
      _callObserver (transaction, parentSubs) {
        super._callObserver(transaction, parentSubs);
        callTypeObservers(this, transaction, new YArrayEvent(this, transaction));
      }

      /**
       * Inserts new content at an index.
       *
       * Important: This function expects an array of content. Not just a content
       * object. The reason for this "weirdness" is that inserting several elements
       * is very efficient when it is done as a single operation.
       *
       * @example
       *  // Insert character 'a' at position 0
       *  yarray.insert(0, ['a'])
       *  // Insert numbers 1, 2 at position 1
       *  yarray.insert(1, [1, 2])
       *
       * @param {number} index The index to insert content at.
       * @param {Array<T>} content The array of content
       */
      insert (index, content) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeListInsertGenerics(transaction, this, index, content);
          });
        } else {
          /** @type {Array<any>} */ (this._prelimContent).splice(index, 0, ...content);
        }
      }

      /**
       * Appends content to this YArray.
       *
       * @param {Array<T>} content Array of content to append.
       */
      push (content) {
        this.insert(this.length, content);
      }

      /**
       * Preppends content to this YArray.
       *
       * @param {Array<T>} content Array of content to preppend.
       */
      unshift (content) {
        this.insert(0, content);
      }

      /**
       * Deletes elements starting from an index.
       *
       * @param {number} index Index at which to start deleting elements
       * @param {number} length The number of elements to remove. Defaults to 1.
       */
      delete (index, length = 1) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeListDelete(transaction, this, index, length);
          });
        } else {
          /** @type {Array<any>} */ (this._prelimContent).splice(index, length);
        }
      }

      /**
       * Returns the i-th element from a YArray.
       *
       * @param {number} index The index of the element to return from the YArray
       * @return {T}
       */
      get (index) {
        return typeListGet(this, index)
      }

      /**
       * Transforms this YArray to a JavaScript Array.
       *
       * @return {Array<T>}
       */
      toArray () {
        return typeListToArray(this)
      }

      /**
       * Transforms this Shared Type to a JSON object.
       *
       * @return {Array<any>}
       */
      toJSON () {
        return this.map(c => c instanceof AbstractType ? c.toJSON() : c)
      }

      /**
       * Returns an Array with the result of calling a provided function on every
       * element of this YArray.
       *
       * @template T,M
       * @param {function(T,number,YArray<T>):M} f Function that produces an element of the new Array
       * @return {Array<M>} A new array with each element being the result of the
       *                 callback function
       */
      map (f) {
        return typeListMap(this, /** @type {any} */ (f))
      }

      /**
       * Executes a provided function on once on overy element of this YArray.
       *
       * @param {function(T,number,YArray<T>):void} f A function to execute on every element of this YArray.
       */
      forEach (f) {
        typeListForEach(this, f);
      }

      /**
       * @return {IterableIterator<T>}
       */
      [Symbol.iterator] () {
        return typeListCreateIterator(this)
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       */
      _write (encoder) {
        encoder.writeTypeRef(YArrayRefID);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     *
     * @private
     * @function
     */
    const readYArray = decoder => new YArray();

    /**
     * @template T
     * Event that describes the changes on a YMap.
     */
    class YMapEvent extends YEvent {
      /**
       * @param {YMap<T>} ymap The YArray that changed.
       * @param {Transaction} transaction
       * @param {Set<any>} subs The keys that changed.
       */
      constructor (ymap, transaction, subs) {
        super(ymap, transaction);
        this.keysChanged = subs;
      }
    }

    /**
     * @template T number|string|Object|Array|Uint8Array
     * A shared Map implementation.
     *
     * @extends AbstractType<YMapEvent<T>>
     * @implements {Iterable<T>}
     */
    class YMap extends AbstractType {
      /**
       *
       * @param {Iterable<readonly [string, any]>=} entries - an optional iterable to initialize the YMap
       */
      constructor (entries) {
        super();
        /**
         * @type {Map<string,any>?}
         * @private
         */
        this._prelimContent = null;

        if (entries === undefined) {
          this._prelimContent = new Map();
        } else {
          this._prelimContent = new Map(entries);
        }
      }

      /**
       * Integrate this type into the Yjs instance.
       *
       * * Save this struct in the os
       * * This type is sent to other client
       * * Observer functions are fired
       *
       * @param {Doc} y The Yjs instance
       * @param {Item} item
       */
      _integrate (y, item) {
        super._integrate(y, item)
        ;/** @type {Map<string, any>} */ (this._prelimContent).forEach((value, key) => {
          this.set(key, value);
        });
        this._prelimContent = null;
      }

      _copy () {
        return new YMap()
      }

      /**
       * Creates YMapEvent and calls observers.
       *
       * @param {Transaction} transaction
       * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
       */
      _callObserver (transaction, parentSubs) {
        callTypeObservers(this, transaction, new YMapEvent(this, transaction, parentSubs));
      }

      /**
       * Transforms this Shared Type to a JSON object.
       *
       * @return {Object<string,T>}
       */
      toJSON () {
        /**
         * @type {Object<string,T>}
         */
        const map = {};
        this._map.forEach((item, key) => {
          if (!item.deleted) {
            const v = item.content.getContent()[item.length - 1];
            map[key] = v instanceof AbstractType ? v.toJSON() : v;
          }
        });
        return map
      }

      /**
       * Returns the size of the YMap (count of key/value pairs)
       *
       * @return {number}
       */
      get size () {
        return [...createMapIterator(this._map)].length
      }

      /**
       * Returns the keys for each element in the YMap Type.
       *
       * @return {IterableIterator<string>}
       */
      keys () {
        return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[0])
      }

      /**
       * Returns the values for each element in the YMap Type.
       *
       * @return {IterableIterator<any>}
       */
      values () {
        return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => v[1].content.getContent()[v[1].length - 1])
      }

      /**
       * Returns an Iterator of [key, value] pairs
       *
       * @return {IterableIterator<any>}
       */
      entries () {
        return iteratorMap(createMapIterator(this._map), /** @param {any} v */ v => [v[0], v[1].content.getContent()[v[1].length - 1]])
      }

      /**
       * Executes a provided function on once on every key-value pair.
       *
       * @param {function(T,string,YMap<T>):void} f A function to execute on every element of this YArray.
       */
      forEach (f) {
        /**
         * @type {Object<string,T>}
         */
        const map = {};
        this._map.forEach((item, key) => {
          if (!item.deleted) {
            f(item.content.getContent()[item.length - 1], key, this);
          }
        });
        return map
      }

      /**
       * @return {IterableIterator<T>}
       */
      [Symbol.iterator] () {
        return this.entries()
      }

      /**
       * Remove a specified element from this YMap.
       *
       * @param {string} key The key of the element to remove.
       */
      delete (key) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeMapDelete(transaction, this, key);
          });
        } else {
          /** @type {Map<string, any>} */ (this._prelimContent).delete(key);
        }
      }

      /**
       * Adds or updates an element with a specified key and value.
       *
       * @param {string} key The key of the element to add to this YMap
       * @param {T} value The value of the element to add
       */
      set (key, value) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeMapSet(transaction, this, key, value);
          });
        } else {
          /** @type {Map<string, any>} */ (this._prelimContent).set(key, value);
        }
        return value
      }

      /**
       * Returns a specified element from this YMap.
       *
       * @param {string} key
       * @return {T|undefined}
       */
      get (key) {
        return /** @type {any} */ (typeMapGet(this, key))
      }

      /**
       * Returns a boolean indicating whether the specified key exists or not.
       *
       * @param {string} key The key to test.
       * @return {boolean}
       */
      has (key) {
        return typeMapHas(this, key)
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       */
      _write (encoder) {
        encoder.writeTypeRef(YMapRefID);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     *
     * @private
     * @function
     */
    const readYMap = decoder => new YMap();

    /**
     * @param {any} a
     * @param {any} b
     * @return {boolean}
     */
    const equalAttrs = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && a && b && equalFlat(a, b));

    class ItemTextListPosition {
      /**
       * @param {Item|null} left
       * @param {Item|null} right
       * @param {number} index
       * @param {Map<string,any>} currentAttributes
       */
      constructor (left, right, index, currentAttributes) {
        this.left = left;
        this.right = right;
        this.index = index;
        this.currentAttributes = currentAttributes;
      }

      /**
       * Only call this if you know that this.right is defined
       */
      forward () {
        if (this.right === null) {
          unexpectedCase();
        }
        switch (this.right.content.constructor) {
          case ContentEmbed:
          case ContentString:
            if (!this.right.deleted) {
              this.index += this.right.length;
            }
            break
          case ContentFormat:
            if (!this.right.deleted) {
              updateCurrentAttributes(this.currentAttributes, /** @type {ContentFormat} */ (this.right.content));
            }
            break
        }
        this.left = this.right;
        this.right = this.right.right;
      }
    }

    /**
     * @param {Transaction} transaction
     * @param {ItemTextListPosition} pos
     * @param {number} count steps to move forward
     * @return {ItemTextListPosition}
     *
     * @private
     * @function
     */
    const findNextPosition = (transaction, pos, count) => {
      while (pos.right !== null && count > 0) {
        switch (pos.right.content.constructor) {
          case ContentEmbed:
          case ContentString:
            if (!pos.right.deleted) {
              if (count < pos.right.length) {
                // split right
                getItemCleanStart(transaction, createID(pos.right.id.client, pos.right.id.clock + count));
              }
              pos.index += pos.right.length;
              count -= pos.right.length;
            }
            break
          case ContentFormat:
            if (!pos.right.deleted) {
              updateCurrentAttributes(pos.currentAttributes, /** @type {ContentFormat} */ (pos.right.content));
            }
            break
        }
        pos.left = pos.right;
        pos.right = pos.right.right;
        // pos.forward() - we don't forward because that would halve the performance because we already do the checks above
      }
      return pos
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {number} index
     * @return {ItemTextListPosition}
     *
     * @private
     * @function
     */
    const findPosition = (transaction, parent, index) => {
      const currentAttributes = new Map();
      const marker = findMarker(parent, index);
      if (marker) {
        const pos = new ItemTextListPosition(marker.p.left, marker.p, marker.index, currentAttributes);
        return findNextPosition(transaction, pos, index - marker.index)
      } else {
        const pos = new ItemTextListPosition(null, parent._start, 0, currentAttributes);
        return findNextPosition(transaction, pos, index)
      }
    };

    /**
     * Negate applied formats
     *
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {ItemTextListPosition} currPos
     * @param {Map<string,any>} negatedAttributes
     *
     * @private
     * @function
     */
    const insertNegatedAttributes = (transaction, parent, currPos, negatedAttributes) => {
      // check if we really need to remove attributes
      while (
        currPos.right !== null && (
          currPos.right.deleted === true || (
            currPos.right.content.constructor === ContentFormat &&
            equalAttrs(negatedAttributes.get(/** @type {ContentFormat} */ (currPos.right.content).key), /** @type {ContentFormat} */ (currPos.right.content).value)
          )
        )
      ) {
        if (!currPos.right.deleted) {
          negatedAttributes.delete(/** @type {ContentFormat} */ (currPos.right.content).key);
        }
        currPos.forward();
      }
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      let left = currPos.left;
      const right = currPos.right;
      negatedAttributes.forEach((val, key) => {
        left = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val));
        left.integrate(transaction, 0);
      });
    };

    /**
     * @param {Map<string,any>} currentAttributes
     * @param {ContentFormat} format
     *
     * @private
     * @function
     */
    const updateCurrentAttributes = (currentAttributes, format) => {
      const { key, value } = format;
      if (value === null) {
        currentAttributes.delete(key);
      } else {
        currentAttributes.set(key, value);
      }
    };

    /**
     * @param {ItemTextListPosition} currPos
     * @param {Object<string,any>} attributes
     *
     * @private
     * @function
     */
    const minimizeAttributeChanges = (currPos, attributes) => {
      // go right while attributes[right.key] === right.value (or right is deleted)
      while (true) {
        if (currPos.right === null) {
          break
        } else if (currPos.right.deleted || (currPos.right.content.constructor === ContentFormat && equalAttrs(attributes[(/** @type {ContentFormat} */ (currPos.right.content)).key] || null, /** @type {ContentFormat} */ (currPos.right.content).value))) ; else {
          break
        }
        currPos.forward();
      }
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {ItemTextListPosition} currPos
     * @param {Object<string,any>} attributes
     * @return {Map<string,any>}
     *
     * @private
     * @function
     **/
    const insertAttributes = (transaction, parent, currPos, attributes) => {
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      const negatedAttributes = new Map();
      // insert format-start items
      for (const key in attributes) {
        const val = attributes[key];
        const currentVal = currPos.currentAttributes.get(key) || null;
        if (!equalAttrs(currentVal, val)) {
          // save negated attribute (set null if currentVal undefined)
          negatedAttributes.set(key, currentVal);
          const { left, right } = currPos;
          currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentFormat(key, val));
          currPos.right.integrate(transaction, 0);
          currPos.forward();
        }
      }
      return negatedAttributes
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {ItemTextListPosition} currPos
     * @param {string|object} text
     * @param {Object<string,any>} attributes
     *
     * @private
     * @function
     **/
    const insertText = (transaction, parent, currPos, text, attributes) => {
      currPos.currentAttributes.forEach((val, key) => {
        if (attributes[key] === undefined) {
          attributes[key] = null;
        }
      });
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      minimizeAttributeChanges(currPos, attributes);
      const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes);
      // insert content
      const content = text.constructor === String ? new ContentString(/** @type {string} */ (text)) : new ContentEmbed(text);
      let { left, right, index } = currPos;
      if (parent._searchMarker) {
        updateMarkerChanges(parent._searchMarker, currPos.index, content.getLength());
      }
      right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, content);
      right.integrate(transaction, 0);
      currPos.right = right;
      currPos.index = index;
      currPos.forward();
      insertNegatedAttributes(transaction, parent, currPos, negatedAttributes);
    };

    /**
     * @param {Transaction} transaction
     * @param {AbstractType<any>} parent
     * @param {ItemTextListPosition} currPos
     * @param {number} length
     * @param {Object<string,any>} attributes
     *
     * @private
     * @function
     */
    const formatText = (transaction, parent, currPos, length, attributes) => {
      const doc = transaction.doc;
      const ownClientId = doc.clientID;
      minimizeAttributeChanges(currPos, attributes);
      const negatedAttributes = insertAttributes(transaction, parent, currPos, attributes);
      // iterate until first non-format or null is found
      // delete all formats with attributes[format.key] != null
      while (length > 0 && currPos.right !== null) {
        if (!currPos.right.deleted) {
          switch (currPos.right.content.constructor) {
            case ContentFormat: {
              const { key, value } = /** @type {ContentFormat} */ (currPos.right.content);
              const attr = attributes[key];
              if (attr !== undefined) {
                if (equalAttrs(attr, value)) {
                  negatedAttributes.delete(key);
                } else {
                  negatedAttributes.set(key, value);
                }
                currPos.right.delete(transaction);
              }
              break
            }
            case ContentEmbed:
            case ContentString:
              if (length < currPos.right.length) {
                getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length));
              }
              length -= currPos.right.length;
              break
          }
        }
        currPos.forward();
      }
      // Quill just assumes that the editor starts with a newline and that it always
      // ends with a newline. We only insert that newline when a new newline is
      // inserted - i.e when length is bigger than type.length
      if (length > 0) {
        let newlines = '';
        for (; length > 0; length--) {
          newlines += '\n';
        }
        currPos.right = new Item(createID(ownClientId, getState(doc.store, ownClientId)), currPos.left, currPos.left && currPos.left.lastId, currPos.right, currPos.right && currPos.right.id, parent, null, new ContentString(newlines));
        currPos.right.integrate(transaction, 0);
        currPos.forward();
      }
      insertNegatedAttributes(transaction, parent, currPos, negatedAttributes);
    };

    /**
     * Call this function after string content has been deleted in order to
     * clean up formatting Items.
     *
     * @param {Transaction} transaction
     * @param {Item} start
     * @param {Item|null} end exclusive end, automatically iterates to the next Content Item
     * @param {Map<string,any>} startAttributes
     * @param {Map<string,any>} endAttributes This attribute is modified!
     * @return {number} The amount of formatting Items deleted.
     *
     * @function
     */
    const cleanupFormattingGap = (transaction, start, end, startAttributes, endAttributes) => {
      while (end && end.content.constructor !== ContentString && end.content.constructor !== ContentEmbed) {
        if (!end.deleted && end.content.constructor === ContentFormat) {
          updateCurrentAttributes(endAttributes, /** @type {ContentFormat} */ (end.content));
        }
        end = end.right;
      }
      let cleanups = 0;
      while (start !== end) {
        if (!start.deleted) {
          const content = start.content;
          switch (content.constructor) {
            case ContentFormat: {
              const { key, value } = /** @type {ContentFormat} */ (content);
              if ((endAttributes.get(key) || null) !== value || (startAttributes.get(key) || null) === value) {
                // Either this format is overwritten or it is not necessary because the attribute already existed.
                start.delete(transaction);
                cleanups++;
              }
              break
            }
          }
        }
        start = /** @type {Item} */ (start.right);
      }
      return cleanups
    };

    /**
     * @param {Transaction} transaction
     * @param {Item | null} item
     */
    const cleanupContextlessFormattingGap = (transaction, item) => {
      // iterate until item.right is null or content
      while (item && item.right && (item.right.deleted || (item.right.content.constructor !== ContentString && item.right.content.constructor !== ContentEmbed))) {
        item = item.right;
      }
      const attrs = new Set();
      // iterate back until a content item is found
      while (item && (item.deleted || (item.content.constructor !== ContentString && item.content.constructor !== ContentEmbed))) {
        if (!item.deleted && item.content.constructor === ContentFormat) {
          const key = /** @type {ContentFormat} */ (item.content).key;
          if (attrs.has(key)) {
            item.delete(transaction);
          } else {
            attrs.add(key);
          }
        }
        item = item.left;
      }
    };

    /**
     * This function is experimental and subject to change / be removed.
     *
     * Ideally, we don't need this function at all. Formatting attributes should be cleaned up
     * automatically after each change. This function iterates twice over the complete YText type
     * and removes unnecessary formatting attributes. This is also helpful for testing.
     *
     * This function won't be exported anymore as soon as there is confidence that the YText type works as intended.
     *
     * @param {YText} type
     * @return {number} How many formatting attributes have been cleaned up.
     */
    const cleanupYTextFormatting = type => {
      let res = 0;
      transact(/** @type {Doc} */ (type.doc), transaction => {
        let start = /** @type {Item} */ (type._start);
        let end = type._start;
        let startAttributes = create();
        const currentAttributes = copy(startAttributes);
        while (end) {
          if (end.deleted === false) {
            switch (end.content.constructor) {
              case ContentFormat:
                updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (end.content));
                break
              case ContentEmbed:
              case ContentString:
                res += cleanupFormattingGap(transaction, start, end, startAttributes, currentAttributes);
                startAttributes = copy(currentAttributes);
                start = end;
                break
            }
          }
          end = end.right;
        }
      });
      return res
    };

    /**
     * @param {Transaction} transaction
     * @param {ItemTextListPosition} currPos
     * @param {number} length
     * @return {ItemTextListPosition}
     *
     * @private
     * @function
     */
    const deleteText = (transaction, currPos, length) => {
      const startLength = length;
      const startAttrs = copy(currPos.currentAttributes);
      const start = currPos.right;
      while (length > 0 && currPos.right !== null) {
        if (currPos.right.deleted === false) {
          switch (currPos.right.content.constructor) {
            case ContentEmbed:
            case ContentString:
              if (length < currPos.right.length) {
                getItemCleanStart(transaction, createID(currPos.right.id.client, currPos.right.id.clock + length));
              }
              length -= currPos.right.length;
              currPos.right.delete(transaction);
              break
          }
        }
        currPos.forward();
      }
      if (start) {
        cleanupFormattingGap(transaction, start, currPos.right, startAttrs, copy(currPos.currentAttributes));
      }
      const parent = /** @type {AbstractType<any>} */ (/** @type {Item} */ (currPos.left || currPos.right).parent);
      if (parent._searchMarker) {
        updateMarkerChanges(parent._searchMarker, currPos.index, -startLength + length);
      }
      return currPos
    };

    /**
     * The Quill Delta format represents changes on a text document with
     * formatting information. For mor information visit {@link https://quilljs.com/docs/delta/|Quill Delta}
     *
     * @example
     *   {
     *     ops: [
     *       { insert: 'Gandalf', attributes: { bold: true } },
     *       { insert: ' the ' },
     *       { insert: 'Grey', attributes: { color: '#cccccc' } }
     *     ]
     *   }
     *
     */

    /**
      * Attributes that can be assigned to a selection of text.
      *
      * @example
      *   {
      *     bold: true,
      *     font-size: '40px'
      *   }
      *
      * @typedef {Object} TextAttributes
      */

    /**
     * @typedef {Object} DeltaItem
     * @property {number|undefined} DeltaItem.delete
     * @property {number|undefined} DeltaItem.retain
     * @property {string|undefined} DeltaItem.insert
     * @property {Object<string,any>} DeltaItem.attributes
     */

    /**
     * Event that describes the changes on a YText type.
     */
    class YTextEvent extends YEvent {
      /**
       * @param {YText} ytext
       * @param {Transaction} transaction
       */
      constructor (ytext, transaction) {
        super(ytext, transaction);
        /**
         * @type {Array<DeltaItem>|null}
         */
        this._delta = null;
      }

      /**
       * Compute the changes in the delta format.
       * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
       *
       * @type {Array<DeltaItem>}
       *
       * @public
       */
      get delta () {
        if (this._delta === null) {
          const y = /** @type {Doc} */ (this.target.doc);
          this._delta = [];
          transact(y, transaction => {
            const delta = /** @type {Array<DeltaItem>} */ (this._delta);
            const currentAttributes = new Map(); // saves all current attributes for insert
            const oldAttributes = new Map();
            let item = this.target._start;
            /**
             * @type {string?}
             */
            let action = null;
            /**
             * @type {Object<string,any>}
             */
            const attributes = {}; // counts added or removed new attributes for retain
            /**
             * @type {string|object}
             */
            let insert = '';
            let retain = 0;
            let deleteLen = 0;
            const addOp = () => {
              if (action !== null) {
                /**
                 * @type {any}
                 */
                let op;
                switch (action) {
                  case 'delete':
                    op = { delete: deleteLen };
                    deleteLen = 0;
                    break
                  case 'insert':
                    op = { insert };
                    if (currentAttributes.size > 0) {
                      op.attributes = {};
                      currentAttributes.forEach((value, key) => {
                        if (value !== null) {
                          op.attributes[key] = value;
                        }
                      });
                    }
                    insert = '';
                    break
                  case 'retain':
                    op = { retain };
                    if (Object.keys(attributes).length > 0) {
                      op.attributes = {};
                      for (const key in attributes) {
                        op.attributes[key] = attributes[key];
                      }
                    }
                    retain = 0;
                    break
                }
                delta.push(op);
                action = null;
              }
            };
            while (item !== null) {
              switch (item.content.constructor) {
                case ContentEmbed:
                  if (this.adds(item)) {
                    if (!this.deletes(item)) {
                      addOp();
                      action = 'insert';
                      insert = /** @type {ContentEmbed} */ (item.content).embed;
                      addOp();
                    }
                  } else if (this.deletes(item)) {
                    if (action !== 'delete') {
                      addOp();
                      action = 'delete';
                    }
                    deleteLen += 1;
                  } else if (!item.deleted) {
                    if (action !== 'retain') {
                      addOp();
                      action = 'retain';
                    }
                    retain += 1;
                  }
                  break
                case ContentString:
                  if (this.adds(item)) {
                    if (!this.deletes(item)) {
                      if (action !== 'insert') {
                        addOp();
                        action = 'insert';
                      }
                      insert += /** @type {ContentString} */ (item.content).str;
                    }
                  } else if (this.deletes(item)) {
                    if (action !== 'delete') {
                      addOp();
                      action = 'delete';
                    }
                    deleteLen += item.length;
                  } else if (!item.deleted) {
                    if (action !== 'retain') {
                      addOp();
                      action = 'retain';
                    }
                    retain += item.length;
                  }
                  break
                case ContentFormat: {
                  const { key, value } = /** @type {ContentFormat} */ (item.content);
                  if (this.adds(item)) {
                    if (!this.deletes(item)) {
                      const curVal = currentAttributes.get(key) || null;
                      if (!equalAttrs(curVal, value)) {
                        if (action === 'retain') {
                          addOp();
                        }
                        if (equalAttrs(value, (oldAttributes.get(key) || null))) {
                          delete attributes[key];
                        } else {
                          attributes[key] = value;
                        }
                      } else {
                        item.delete(transaction);
                      }
                    }
                  } else if (this.deletes(item)) {
                    oldAttributes.set(key, value);
                    const curVal = currentAttributes.get(key) || null;
                    if (!equalAttrs(curVal, value)) {
                      if (action === 'retain') {
                        addOp();
                      }
                      attributes[key] = curVal;
                    }
                  } else if (!item.deleted) {
                    oldAttributes.set(key, value);
                    const attr = attributes[key];
                    if (attr !== undefined) {
                      if (!equalAttrs(attr, value)) {
                        if (action === 'retain') {
                          addOp();
                        }
                        if (value === null) {
                          attributes[key] = value;
                        } else {
                          delete attributes[key];
                        }
                      } else {
                        item.delete(transaction);
                      }
                    }
                  }
                  if (!item.deleted) {
                    if (action === 'insert') {
                      addOp();
                    }
                    updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (item.content));
                  }
                  break
                }
              }
              item = item.right;
            }
            addOp();
            while (delta.length > 0) {
              const lastOp = delta[delta.length - 1];
              if (lastOp.retain !== undefined && lastOp.attributes === undefined) {
                // retain delta's if they don't assign attributes
                delta.pop();
              } else {
                break
              }
            }
          });
        }
        return this._delta
      }
    }

    /**
     * Type that represents text with formatting information.
     *
     * This type replaces y-richtext as this implementation is able to handle
     * block formats (format information on a paragraph), embeds (complex elements
     * like pictures and videos), and text formats (**bold**, *italic*).
     *
     * @extends AbstractType<YTextEvent>
     */
    class YText extends AbstractType {
      /**
       * @param {String} [string] The initial value of the YText.
       */
      constructor (string) {
        super();
        /**
         * Array of pending operations on this type
         * @type {Array<function():void>?}
         */
        this._pending = string !== undefined ? [() => this.insert(0, string)] : [];
        /**
         * @type {Array<ArraySearchMarker>}
         */
        this._searchMarker = [];
      }

      /**
       * Number of characters of this text type.
       *
       * @type {number}
       */
      get length () {
        return this._length
      }

      /**
       * @param {Doc} y
       * @param {Item} item
       */
      _integrate (y, item) {
        super._integrate(y, item);
        try {
          /** @type {Array<function>} */ (this._pending).forEach(f => f());
        } catch (e) {
          console.error(e);
        }
        this._pending = null;
      }

      _copy () {
        return new YText()
      }

      /**
       * Creates YTextEvent and calls observers.
       *
       * @param {Transaction} transaction
       * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
       */
      _callObserver (transaction, parentSubs) {
        super._callObserver(transaction, parentSubs);
        const event = new YTextEvent(this, transaction);
        const doc = transaction.doc;
        // If a remote change happened, we try to cleanup potential formatting duplicates.
        if (!transaction.local) {
          // check if another formatting item was inserted
          let foundFormattingItem = false;
          for (const [client, afterClock] of transaction.afterState.entries()) {
            const clock = transaction.beforeState.get(client) || 0;
            if (afterClock === clock) {
              continue
            }
            iterateStructs(transaction, /** @type {Array<Item|GC>} */ (doc.store.clients.get(client)), clock, afterClock, item => {
              if (!item.deleted && /** @type {Item} */ (item).content.constructor === ContentFormat) {
                foundFormattingItem = true;
              }
            });
            if (foundFormattingItem) {
              break
            }
          }
          if (!foundFormattingItem) {
            iterateDeletedStructs(transaction, transaction.deleteSet, item => {
              if (item instanceof GC || foundFormattingItem) {
                return
              }
              if (item.parent === this && item.content.constructor === ContentFormat) {
                foundFormattingItem = true;
              }
            });
          }
          transact(doc, (t) => {
            if (foundFormattingItem) {
              // If a formatting item was inserted, we simply clean the whole type.
              // We need to compute currentAttributes for the current position anyway.
              cleanupYTextFormatting(this);
            } else {
              // If no formatting attribute was inserted, we can make due with contextless
              // formatting cleanups.
              // Contextless: it is not necessary to compute currentAttributes for the affected position.
              iterateDeletedStructs(t, t.deleteSet, item => {
                if (item instanceof GC) {
                  return
                }
                if (item.parent === this) {
                  cleanupContextlessFormattingGap(t, item);
                }
              });
            }
          });
        }
        callTypeObservers(this, transaction, event);
      }

      /**
       * Returns the unformatted string representation of this YText type.
       *
       * @public
       */
      toString () {
        let str = '';
        /**
         * @type {Item|null}
         */
        let n = this._start;
        while (n !== null) {
          if (!n.deleted && n.countable && n.content.constructor === ContentString) {
            str += /** @type {ContentString} */ (n.content).str;
          }
          n = n.right;
        }
        return str
      }

      /**
       * Returns the unformatted string representation of this YText type.
       *
       * @return {string}
       * @public
       */
      toJSON () {
        return this.toString()
      }

      /**
       * Apply a {@link Delta} on this shared YText type.
       *
       * @param {any} delta The changes to apply on this element.
       * @param {object}  [opts]
       * @param {boolean} [opts.sanitize] Sanitize input delta. Removes ending newlines if set to true.
       *
       *
       * @public
       */
      applyDelta (delta, { sanitize = true } = {}) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            const currPos = new ItemTextListPosition(null, this._start, 0, new Map());
            for (let i = 0; i < delta.length; i++) {
              const op = delta[i];
              if (op.insert !== undefined) {
                // Quill assumes that the content starts with an empty paragraph.
                // Yjs/Y.Text assumes that it starts empty. We always hide that
                // there is a newline at the end of the content.
                // If we omit this step, clients will see a different number of
                // paragraphs, but nothing bad will happen.
                const ins = (!sanitize && typeof op.insert === 'string' && i === delta.length - 1 && currPos.right === null && op.insert.slice(-1) === '\n') ? op.insert.slice(0, -1) : op.insert;
                if (typeof ins !== 'string' || ins.length > 0) {
                  insertText(transaction, this, currPos, ins, op.attributes || {});
                }
              } else if (op.retain !== undefined) {
                formatText(transaction, this, currPos, op.retain, op.attributes || {});
              } else if (op.delete !== undefined) {
                deleteText(transaction, currPos, op.delete);
              }
            }
          });
        } else {
          /** @type {Array<function>} */ (this._pending).push(() => this.applyDelta(delta));
        }
      }

      /**
       * Returns the Delta representation of this YText type.
       *
       * @param {Snapshot} [snapshot]
       * @param {Snapshot} [prevSnapshot]
       * @param {function('removed' | 'added', ID):any} [computeYChange]
       * @return {any} The Delta representation of this type.
       *
       * @public
       */
      toDelta (snapshot, prevSnapshot, computeYChange) {
        /**
         * @type{Array<any>}
         */
        const ops = [];
        const currentAttributes = new Map();
        const doc = /** @type {Doc} */ (this.doc);
        let str = '';
        let n = this._start;
        function packStr () {
          if (str.length > 0) {
            // pack str with attributes to ops
            /**
             * @type {Object<string,any>}
             */
            const attributes = {};
            let addAttributes = false;
            currentAttributes.forEach((value, key) => {
              addAttributes = true;
              attributes[key] = value;
            });
            /**
             * @type {Object<string,any>}
             */
            const op = { insert: str };
            if (addAttributes) {
              op.attributes = attributes;
            }
            ops.push(op);
            str = '';
          }
        }
        // snapshots are merged again after the transaction, so we need to keep the
        // transalive until we are done
        transact(doc, transaction => {
          if (snapshot) {
            splitSnapshotAffectedStructs(transaction, snapshot);
          }
          if (prevSnapshot) {
            splitSnapshotAffectedStructs(transaction, prevSnapshot);
          }
          while (n !== null) {
            if (isVisible(n, snapshot) || (prevSnapshot !== undefined && isVisible(n, prevSnapshot))) {
              switch (n.content.constructor) {
                case ContentString: {
                  const cur = currentAttributes.get('ychange');
                  if (snapshot !== undefined && !isVisible(n, snapshot)) {
                    if (cur === undefined || cur.user !== n.id.client || cur.state !== 'removed') {
                      packStr();
                      currentAttributes.set('ychange', computeYChange ? computeYChange('removed', n.id) : { type: 'removed' });
                    }
                  } else if (prevSnapshot !== undefined && !isVisible(n, prevSnapshot)) {
                    if (cur === undefined || cur.user !== n.id.client || cur.state !== 'added') {
                      packStr();
                      currentAttributes.set('ychange', computeYChange ? computeYChange('added', n.id) : { type: 'added' });
                    }
                  } else if (cur !== undefined) {
                    packStr();
                    currentAttributes.delete('ychange');
                  }
                  str += /** @type {ContentString} */ (n.content).str;
                  break
                }
                case ContentEmbed: {
                  packStr();
                  /**
                   * @type {Object<string,any>}
                   */
                  const op = {
                    insert: /** @type {ContentEmbed} */ (n.content).embed
                  };
                  if (currentAttributes.size > 0) {
                    const attrs = /** @type {Object<string,any>} */ ({});
                    op.attributes = attrs;
                    currentAttributes.forEach((value, key) => {
                      attrs[key] = value;
                    });
                  }
                  ops.push(op);
                  break
                }
                case ContentFormat:
                  if (isVisible(n, snapshot)) {
                    packStr();
                    updateCurrentAttributes(currentAttributes, /** @type {ContentFormat} */ (n.content));
                  }
                  break
              }
            }
            n = n.right;
          }
          packStr();
        }, splitSnapshotAffectedStructs);
        return ops
      }

      /**
       * Insert text at a given index.
       *
       * @param {number} index The index at which to start inserting.
       * @param {String} text The text to insert at the specified position.
       * @param {TextAttributes} [attributes] Optionally define some formatting
       *                                    information to apply on the inserted
       *                                    Text.
       * @public
       */
      insert (index, text, attributes) {
        if (text.length <= 0) {
          return
        }
        const y = this.doc;
        if (y !== null) {
          transact(y, transaction => {
            const pos = findPosition(transaction, this, index);
            if (!attributes) {
              attributes = {};
              // @ts-ignore
              pos.currentAttributes.forEach((v, k) => { attributes[k] = v; });
            }
            insertText(transaction, this, pos, text, attributes);
          });
        } else {
          /** @type {Array<function>} */ (this._pending).push(() => this.insert(index, text, attributes));
        }
      }

      /**
       * Inserts an embed at a index.
       *
       * @param {number} index The index to insert the embed at.
       * @param {Object} embed The Object that represents the embed.
       * @param {TextAttributes} attributes Attribute information to apply on the
       *                                    embed
       *
       * @public
       */
      insertEmbed (index, embed, attributes = {}) {
        if (embed.constructor !== Object) {
          throw new Error('Embed must be an Object')
        }
        const y = this.doc;
        if (y !== null) {
          transact(y, transaction => {
            const pos = findPosition(transaction, this, index);
            insertText(transaction, this, pos, embed, attributes);
          });
        } else {
          /** @type {Array<function>} */ (this._pending).push(() => this.insertEmbed(index, embed, attributes));
        }
      }

      /**
       * Deletes text starting from an index.
       *
       * @param {number} index Index at which to start deleting.
       * @param {number} length The number of characters to remove. Defaults to 1.
       *
       * @public
       */
      delete (index, length) {
        if (length === 0) {
          return
        }
        const y = this.doc;
        if (y !== null) {
          transact(y, transaction => {
            deleteText(transaction, findPosition(transaction, this, index), length);
          });
        } else {
          /** @type {Array<function>} */ (this._pending).push(() => this.delete(index, length));
        }
      }

      /**
       * Assigns properties to a range of text.
       *
       * @param {number} index The position where to start formatting.
       * @param {number} length The amount of characters to assign properties to.
       * @param {TextAttributes} attributes Attribute information to apply on the
       *                                    text.
       *
       * @public
       */
      format (index, length, attributes) {
        if (length === 0) {
          return
        }
        const y = this.doc;
        if (y !== null) {
          transact(y, transaction => {
            const pos = findPosition(transaction, this, index);
            if (pos.right === null) {
              return
            }
            formatText(transaction, this, pos, length, attributes);
          });
        } else {
          /** @type {Array<function>} */ (this._pending).push(() => this.format(index, length, attributes));
        }
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       */
      _write (encoder) {
        encoder.writeTypeRef(YTextRefID);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {YText}
     *
     * @private
     * @function
     */
    const readYText = decoder => new YText();

    /**
     * @module YXml
     */

    /**
     * Define the elements to which a set of CSS queries apply.
     * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
     *
     * @example
     *   query = '.classSelector'
     *   query = 'nodeSelector'
     *   query = '#idSelector'
     *
     * @typedef {string} CSS_Selector
     */

    /**
     * Dom filter function.
     *
     * @callback domFilter
     * @param {string} nodeName The nodeName of the element
     * @param {Map} attributes The map of attributes.
     * @return {boolean} Whether to include the Dom node in the YXmlElement.
     */

    /**
     * Represents a subset of the nodes of a YXmlElement / YXmlFragment and a
     * position within them.
     *
     * Can be created with {@link YXmlFragment#createTreeWalker}
     *
     * @public
     * @implements {Iterable<YXmlElement|YXmlText|YXmlElement|YXmlHook>}
     */
    class YXmlTreeWalker {
      /**
       * @param {YXmlFragment | YXmlElement} root
       * @param {function(AbstractType<any>):boolean} [f]
       */
      constructor (root, f = () => true) {
        this._filter = f;
        this._root = root;
        /**
         * @type {Item}
         */
        this._currentNode = /** @type {Item} */ (root._start);
        this._firstCall = true;
      }

      [Symbol.iterator] () {
        return this
      }

      /**
       * Get the next node.
       *
       * @return {IteratorResult<YXmlElement|YXmlText|YXmlHook>} The next node.
       *
       * @public
       */
      next () {
        /**
         * @type {Item|null}
         */
        let n = this._currentNode;
        let type = /** @type {any} */ (n.content).type;
        if (n !== null && (!this._firstCall || n.deleted || !this._filter(type))) { // if first call, we check if we can use the first item
          do {
            type = /** @type {any} */ (n.content).type;
            if (!n.deleted && (type.constructor === YXmlElement || type.constructor === YXmlFragment) && type._start !== null) {
              // walk down in the tree
              n = type._start;
            } else {
              // walk right or up in the tree
              while (n !== null) {
                if (n.right !== null) {
                  n = n.right;
                  break
                } else if (n.parent === this._root) {
                  n = null;
                } else {
                  n = /** @type {AbstractType<any>} */ (n.parent)._item;
                }
              }
            }
          } while (n !== null && (n.deleted || !this._filter(/** @type {ContentType} */ (n.content).type)))
        }
        this._firstCall = false;
        if (n === null) {
          // @ts-ignore
          return { value: undefined, done: true }
        }
        this._currentNode = n;
        return { value: /** @type {any} */ (n.content).type, done: false }
      }
    }

    /**
     * Represents a list of {@link YXmlElement}.and {@link YXmlText} types.
     * A YxmlFragment is similar to a {@link YXmlElement}, but it does not have a
     * nodeName and it does not have attributes. Though it can be bound to a DOM
     * element - in this case the attributes and the nodeName are not shared.
     *
     * @public
     * @extends AbstractType<YXmlEvent>
     */
    class YXmlFragment extends AbstractType {
      constructor () {
        super();
        /**
         * @type {Array<any>|null}
         */
        this._prelimContent = [];
      }

      /**
       * Integrate this type into the Yjs instance.
       *
       * * Save this struct in the os
       * * This type is sent to other client
       * * Observer functions are fired
       *
       * @param {Doc} y The Yjs instance
       * @param {Item} item
       */
      _integrate (y, item) {
        super._integrate(y, item);
        this.insert(0, /** @type {Array<any>} */ (this._prelimContent));
        this._prelimContent = null;
      }

      _copy () {
        return new YXmlFragment()
      }

      get length () {
        return this._prelimContent === null ? this._length : this._prelimContent.length
      }

      /**
       * Create a subtree of childNodes.
       *
       * @example
       * const walker = elem.createTreeWalker(dom => dom.nodeName === 'div')
       * for (let node in walker) {
       *   // `node` is a div node
       *   nop(node)
       * }
       *
       * @param {function(AbstractType<any>):boolean} filter Function that is called on each child element and
       *                          returns a Boolean indicating whether the child
       *                          is to be included in the subtree.
       * @return {YXmlTreeWalker} A subtree and a position within it.
       *
       * @public
       */
      createTreeWalker (filter) {
        return new YXmlTreeWalker(this, filter)
      }

      /**
       * Returns the first YXmlElement that matches the query.
       * Similar to DOM's {@link querySelector}.
       *
       * Query support:
       *   - tagname
       * TODO:
       *   - id
       *   - attribute
       *
       * @param {CSS_Selector} query The query on the children.
       * @return {YXmlElement|YXmlText|YXmlHook|null} The first element that matches the query or null.
       *
       * @public
       */
      querySelector (query) {
        query = query.toUpperCase();
        // @ts-ignore
        const iterator = new YXmlTreeWalker(this, element => element.nodeName && element.nodeName.toUpperCase() === query);
        const next = iterator.next();
        if (next.done) {
          return null
        } else {
          return next.value
        }
      }

      /**
       * Returns all YXmlElements that match the query.
       * Similar to Dom's {@link querySelectorAll}.
       *
       * @todo Does not yet support all queries. Currently only query by tagName.
       *
       * @param {CSS_Selector} query The query on the children
       * @return {Array<YXmlElement|YXmlText|YXmlHook|null>} The elements that match this query.
       *
       * @public
       */
      querySelectorAll (query) {
        query = query.toUpperCase();
        // @ts-ignore
        return Array.from(new YXmlTreeWalker(this, element => element.nodeName && element.nodeName.toUpperCase() === query))
      }

      /**
       * Creates YXmlEvent and calls observers.
       *
       * @param {Transaction} transaction
       * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
       */
      _callObserver (transaction, parentSubs) {
        callTypeObservers(this, transaction, new YXmlEvent(this, parentSubs, transaction));
      }

      /**
       * Get the string representation of all the children of this YXmlFragment.
       *
       * @return {string} The string representation of all children.
       */
      toString () {
        return typeListMap(this, xml => xml.toString()).join('')
      }

      /**
       * @return {string}
       */
      toJSON () {
        return this.toString()
      }

      /**
       * Creates a Dom Element that mirrors this YXmlElement.
       *
       * @param {Document} [_document=document] The document object (you must define
       *                                        this when calling this method in
       *                                        nodejs)
       * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
       *                                             are presented in the DOM
       * @param {any} [binding] You should not set this property. This is
       *                               used if DomBinding wants to create a
       *                               association to the created DOM type.
       * @return {Node} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
       *
       * @public
       */
      toDOM (_document = document, hooks = {}, binding) {
        const fragment = _document.createDocumentFragment();
        if (binding !== undefined) {
          binding._createAssociation(fragment, this);
        }
        typeListForEach(this, xmlType => {
          fragment.insertBefore(xmlType.toDOM(_document, hooks, binding), null);
        });
        return fragment
      }

      /**
       * Inserts new content at an index.
       *
       * @example
       *  // Insert character 'a' at position 0
       *  xml.insert(0, [new Y.XmlText('text')])
       *
       * @param {number} index The index to insert content at
       * @param {Array<YXmlElement|YXmlText>} content The array of content
       */
      insert (index, content) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeListInsertGenerics(transaction, this, index, content);
          });
        } else {
          // @ts-ignore _prelimContent is defined because this is not yet integrated
          this._prelimContent.splice(index, 0, ...content);
        }
      }

      /**
       * Deletes elements starting from an index.
       *
       * @param {number} index Index at which to start deleting elements
       * @param {number} [length=1] The number of elements to remove. Defaults to 1.
       */
      delete (index, length = 1) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeListDelete(transaction, this, index, length);
          });
        } else {
          // @ts-ignore _prelimContent is defined because this is not yet integrated
          this._prelimContent.splice(index, length);
        }
      }

      /**
       * Transforms this YArray to a JavaScript Array.
       *
       * @return {Array<YXmlElement|YXmlText|YXmlHook>}
       */
      toArray () {
        return typeListToArray(this)
      }

      /**
       * Transform the properties of this type to binary and write it to an
       * BinaryEncoder.
       *
       * This is called when this Item is sent to a remote peer.
       *
       * @param {AbstractUpdateEncoder} encoder The encoder to write data to.
       */
      _write (encoder) {
        encoder.writeTypeRef(YXmlFragmentRefID);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {YXmlFragment}
     *
     * @private
     * @function
     */
    const readYXmlFragment = decoder => new YXmlFragment();

    /**
     * An YXmlElement imitates the behavior of a
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}.
     *
     * * An YXmlElement has attributes (key value pairs)
     * * An YXmlElement has childElements that must inherit from YXmlElement
     */
    class YXmlElement extends YXmlFragment {
      constructor (nodeName = 'UNDEFINED') {
        super();
        this.nodeName = nodeName;
        /**
         * @type {Map<string, any>|null}
         */
        this._prelimAttrs = new Map();
      }

      /**
       * Integrate this type into the Yjs instance.
       *
       * * Save this struct in the os
       * * This type is sent to other client
       * * Observer functions are fired
       *
       * @param {Doc} y The Yjs instance
       * @param {Item} item
       */
      _integrate (y, item) {
        super._integrate(y, item)
        ;(/** @type {Map<string, any>} */ (this._prelimAttrs)).forEach((value, key) => {
          this.setAttribute(key, value);
        });
        this._prelimAttrs = null;
      }

      /**
       * Creates an Item with the same effect as this Item (without position effect)
       *
       * @return {YXmlElement}
       */
      _copy () {
        return new YXmlElement(this.nodeName)
      }

      /**
       * Returns the XML serialization of this YXmlElement.
       * The attributes are ordered by attribute-name, so you can easily use this
       * method to compare YXmlElements
       *
       * @return {string} The string representation of this type.
       *
       * @public
       */
      toString () {
        const attrs = this.getAttributes();
        const stringBuilder = [];
        const keys = [];
        for (const key in attrs) {
          keys.push(key);
        }
        keys.sort();
        const keysLen = keys.length;
        for (let i = 0; i < keysLen; i++) {
          const key = keys[i];
          stringBuilder.push(key + '="' + attrs[key] + '"');
        }
        const nodeName = this.nodeName.toLocaleLowerCase();
        const attrsString = stringBuilder.length > 0 ? ' ' + stringBuilder.join(' ') : '';
        return `<${nodeName}${attrsString}>${super.toString()}</${nodeName}>`
      }

      /**
       * Removes an attribute from this YXmlElement.
       *
       * @param {String} attributeName The attribute name that is to be removed.
       *
       * @public
       */
      removeAttribute (attributeName) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeMapDelete(transaction, this, attributeName);
          });
        } else {
          /** @type {Map<string,any>} */ (this._prelimAttrs).delete(attributeName);
        }
      }

      /**
       * Sets or updates an attribute.
       *
       * @param {String} attributeName The attribute name that is to be set.
       * @param {String} attributeValue The attribute value that is to be set.
       *
       * @public
       */
      setAttribute (attributeName, attributeValue) {
        if (this.doc !== null) {
          transact(this.doc, transaction => {
            typeMapSet(transaction, this, attributeName, attributeValue);
          });
        } else {
          /** @type {Map<string, any>} */ (this._prelimAttrs).set(attributeName, attributeValue);
        }
      }

      /**
       * Returns an attribute value that belongs to the attribute name.
       *
       * @param {String} attributeName The attribute name that identifies the
       *                               queried value.
       * @return {String} The queried attribute value.
       *
       * @public
       */
      getAttribute (attributeName) {
        return /** @type {any} */ (typeMapGet(this, attributeName))
      }

      /**
       * Returns all attribute name/value pairs in a JSON Object.
       *
       * @param {Snapshot} [snapshot]
       * @return {Object<string, any>} A JSON Object that describes the attributes.
       *
       * @public
       */
      getAttributes (snapshot) {
        return typeMapGetAll(this)
      }

      /**
       * Creates a Dom Element that mirrors this YXmlElement.
       *
       * @param {Document} [_document=document] The document object (you must define
       *                                        this when calling this method in
       *                                        nodejs)
       * @param {Object<string, any>} [hooks={}] Optional property to customize how hooks
       *                                             are presented in the DOM
       * @param {any} [binding] You should not set this property. This is
       *                               used if DomBinding wants to create a
       *                               association to the created DOM type.
       * @return {Node} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
       *
       * @public
       */
      toDOM (_document = document, hooks = {}, binding) {
        const dom = _document.createElement(this.nodeName);
        const attrs = this.getAttributes();
        for (const key in attrs) {
          dom.setAttribute(key, attrs[key]);
        }
        typeListForEach(this, yxml => {
          dom.appendChild(yxml.toDOM(_document, hooks, binding));
        });
        if (binding !== undefined) {
          binding._createAssociation(dom, this);
        }
        return dom
      }

      /**
       * Transform the properties of this type to binary and write it to an
       * BinaryEncoder.
       *
       * This is called when this Item is sent to a remote peer.
       *
       * @param {AbstractUpdateEncoder} encoder The encoder to write data to.
       */
      _write (encoder) {
        encoder.writeTypeRef(YXmlElementRefID);
        encoder.writeKey(this.nodeName);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {YXmlElement}
     *
     * @function
     */
    const readYXmlElement = decoder => new YXmlElement(decoder.readKey());

    /**
     * An Event that describes changes on a YXml Element or Yxml Fragment
     */
    class YXmlEvent extends YEvent {
      /**
       * @param {YXmlElement|YXmlFragment} target The target on which the event is created.
       * @param {Set<string|null>} subs The set of changed attributes. `null` is included if the
       *                   child list changed.
       * @param {Transaction} transaction The transaction instance with wich the
       *                                  change was created.
       */
      constructor (target, subs, transaction) {
        super(target, transaction);
        /**
         * Whether the children changed.
         * @type {Boolean}
         * @private
         */
        this.childListChanged = false;
        /**
         * Set of all changed attributes.
         * @type {Set<string|null>}
         */
        this.attributesChanged = new Set();
        subs.forEach((sub) => {
          if (sub === null) {
            this.childListChanged = true;
          } else {
            this.attributesChanged.add(sub);
          }
        });
      }
    }

    /**
     * You can manage binding to a custom type with YXmlHook.
     *
     * @extends {YMap<any>}
     */
    class YXmlHook extends YMap {
      /**
       * @param {string} hookName nodeName of the Dom Node.
       */
      constructor (hookName) {
        super();
        /**
         * @type {string}
         */
        this.hookName = hookName;
      }

      /**
       * Creates an Item with the same effect as this Item (without position effect)
       */
      _copy () {
        return new YXmlHook(this.hookName)
      }

      /**
       * Creates a Dom Element that mirrors this YXmlElement.
       *
       * @param {Document} [_document=document] The document object (you must define
       *                                        this when calling this method in
       *                                        nodejs)
       * @param {Object.<string, any>} [hooks] Optional property to customize how hooks
       *                                             are presented in the DOM
       * @param {any} [binding] You should not set this property. This is
       *                               used if DomBinding wants to create a
       *                               association to the created DOM type
       * @return {Element} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
       *
       * @public
       */
      toDOM (_document = document, hooks = {}, binding) {
        const hook = hooks[this.hookName];
        let dom;
        if (hook !== undefined) {
          dom = hook.createDom(this);
        } else {
          dom = document.createElement(this.hookName);
        }
        dom.setAttribute('data-yjs-hook', this.hookName);
        if (binding !== undefined) {
          binding._createAssociation(dom, this);
        }
        return dom
      }

      /**
       * Transform the properties of this type to binary and write it to an
       * BinaryEncoder.
       *
       * This is called when this Item is sent to a remote peer.
       *
       * @param {AbstractUpdateEncoder} encoder The encoder to write data to.
       */
      _write (encoder) {
        encoder.writeTypeRef(YXmlHookRefID);
        encoder.writeKey(this.hookName);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {YXmlHook}
     *
     * @private
     * @function
     */
    const readYXmlHook = decoder =>
      new YXmlHook(decoder.readKey());

    /**
     * Represents text in a Dom Element. In the future this type will also handle
     * simple formatting information like bold and italic.
     */
    class YXmlText extends YText {
      _copy () {
        return new YXmlText()
      }

      /**
       * Creates a Dom Element that mirrors this YXmlText.
       *
       * @param {Document} [_document=document] The document object (you must define
       *                                        this when calling this method in
       *                                        nodejs)
       * @param {Object<string, any>} [hooks] Optional property to customize how hooks
       *                                             are presented in the DOM
       * @param {any} [binding] You should not set this property. This is
       *                               used if DomBinding wants to create a
       *                               association to the created DOM type.
       * @return {Text} The {@link https://developer.mozilla.org/en-US/docs/Web/API/Element|Dom Element}
       *
       * @public
       */
      toDOM (_document = document, hooks, binding) {
        const dom = _document.createTextNode(this.toString());
        if (binding !== undefined) {
          binding._createAssociation(dom, this);
        }
        return dom
      }

      toString () {
        // @ts-ignore
        return this.toDelta().map(delta => {
          const nestedNodes = [];
          for (const nodeName in delta.attributes) {
            const attrs = [];
            for (const key in delta.attributes[nodeName]) {
              attrs.push({ key, value: delta.attributes[nodeName][key] });
            }
            // sort attributes to get a unique order
            attrs.sort((a, b) => a.key < b.key ? -1 : 1);
            nestedNodes.push({ nodeName, attrs });
          }
          // sort node order to get a unique order
          nestedNodes.sort((a, b) => a.nodeName < b.nodeName ? -1 : 1);
          // now convert to dom string
          let str = '';
          for (let i = 0; i < nestedNodes.length; i++) {
            const node = nestedNodes[i];
            str += `<${node.nodeName}`;
            for (let j = 0; j < node.attrs.length; j++) {
              const attr = node.attrs[j];
              str += ` ${attr.key}="${attr.value}"`;
            }
            str += '>';
          }
          str += delta.insert;
          for (let i = nestedNodes.length - 1; i >= 0; i--) {
            str += `</${nestedNodes[i].nodeName}>`;
          }
          return str
        }).join('')
      }

      /**
       * @return {string}
       */
      toJSON () {
        return this.toString()
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       */
      _write (encoder) {
        encoder.writeTypeRef(YXmlTextRefID);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {YXmlText}
     *
     * @private
     * @function
     */
    const readYXmlText = decoder => new YXmlText();

    class AbstractStruct {
      /**
       * @param {ID} id
       * @param {number} length
       */
      constructor (id, length) {
        this.id = id;
        this.length = length;
      }

      /**
       * @type {boolean}
       */
      get deleted () {
        throw methodUnimplemented()
      }

      /**
       * Merge this struct with the item to the right.
       * This method is already assuming that `this.id.clock + this.length === this.id.clock`.
       * Also this method does *not* remove right from StructStore!
       * @param {AbstractStruct} right
       * @return {boolean} wether this merged with right
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {AbstractUpdateEncoder} encoder The encoder to write data to.
       * @param {number} offset
       * @param {number} encodingRef
       */
      write (encoder, offset, encodingRef) {
        throw methodUnimplemented()
      }

      /**
       * @param {Transaction} transaction
       * @param {number} offset
       */
      integrate (transaction, offset) {
        throw methodUnimplemented()
      }
    }

    const structGCRefNumber = 0;

    /**
     * @private
     */
    class GC extends AbstractStruct {
      get deleted () {
        return true
      }

      delete () {}

      /**
       * @param {GC} right
       * @return {boolean}
       */
      mergeWith (right) {
        this.length += right.length;
        return true
      }

      /**
       * @param {Transaction} transaction
       * @param {number} offset
       */
      integrate (transaction, offset) {
        if (offset > 0) {
          this.id.clock += offset;
          this.length -= offset;
        }
        addStruct(transaction.doc.store, this);
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeInfo(structGCRefNumber);
        encoder.writeLen(this.length - offset);
      }

      /**
       * @param {Transaction} transaction
       * @param {StructStore} store
       * @return {null | number}
       */
      getMissing (transaction, store) {
        return null
      }
    }

    class ContentBinary {
      /**
       * @param {Uint8Array} content
       */
      constructor (content) {
        this.content = content;
      }

      /**
       * @return {number}
       */
      getLength () {
        return 1
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return [this.content]
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentBinary}
       */
      copy () {
        return new ContentBinary(this.content)
      }

      /**
       * @param {number} offset
       * @return {ContentBinary}
       */
      splice (offset) {
        throw methodUnimplemented()
      }

      /**
       * @param {ContentBinary} right
       * @return {boolean}
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {}
      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeBuf(this.content);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 3
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentBinary}
     */
    const readContentBinary = decoder => new ContentBinary(decoder.readBuf());

    class ContentDeleted {
      /**
       * @param {number} len
       */
      constructor (len) {
        this.len = len;
      }

      /**
       * @return {number}
       */
      getLength () {
        return this.len
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return []
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return false
      }

      /**
       * @return {ContentDeleted}
       */
      copy () {
        return new ContentDeleted(this.len)
      }

      /**
       * @param {number} offset
       * @return {ContentDeleted}
       */
      splice (offset) {
        const right = new ContentDeleted(this.len - offset);
        this.len = offset;
        return right
      }

      /**
       * @param {ContentDeleted} right
       * @return {boolean}
       */
      mergeWith (right) {
        this.len += right.len;
        return true
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {
        addToDeleteSet(transaction.deleteSet, item.id.client, item.id.clock, this.len);
        item.markDeleted();
      }

      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeLen(this.len - offset);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 1
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentDeleted}
     */
    const readContentDeleted = decoder => new ContentDeleted(decoder.readLen());

    /**
     * @private
     */
    class ContentDoc {
      /**
       * @param {Doc} doc
       */
      constructor (doc) {
        if (doc._item) {
          console.error('This document was already integrated as a sub-document. You should create a second instance instead with the same guid.');
        }
        /**
         * @type {Doc}
         */
        this.doc = doc;
        /**
         * @type {any}
         */
        const opts = {};
        this.opts = opts;
        if (!doc.gc) {
          opts.gc = false;
        }
        if (doc.autoLoad) {
          opts.autoLoad = true;
        }
        if (doc.meta !== null) {
          opts.meta = doc.meta;
        }
      }

      /**
       * @return {number}
       */
      getLength () {
        return 1
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return [this.doc]
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentDoc}
       */
      copy () {
        return new ContentDoc(this.doc)
      }

      /**
       * @param {number} offset
       * @return {ContentDoc}
       */
      splice (offset) {
        throw methodUnimplemented()
      }

      /**
       * @param {ContentDoc} right
       * @return {boolean}
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {
        // this needs to be reflected in doc.destroy as well
        this.doc._item = item;
        transaction.subdocsAdded.add(this.doc);
        if (this.doc.shouldLoad) {
          transaction.subdocsLoaded.add(this.doc);
        }
      }

      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {
        if (transaction.subdocsAdded.has(this.doc)) {
          transaction.subdocsAdded.delete(this.doc);
        } else {
          transaction.subdocsRemoved.add(this.doc);
        }
      }

      /**
       * @param {StructStore} store
       */
      gc (store) { }

      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeString(this.doc.guid);
        encoder.writeAny(this.opts);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 9
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentDoc}
     */
    const readContentDoc = decoder => new ContentDoc(new Doc({ guid: decoder.readString(), ...decoder.readAny() }));

    /**
     * @private
     */
    class ContentEmbed {
      /**
       * @param {Object} embed
       */
      constructor (embed) {
        this.embed = embed;
      }

      /**
       * @return {number}
       */
      getLength () {
        return 1
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return [this.embed]
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentEmbed}
       */
      copy () {
        return new ContentEmbed(this.embed)
      }

      /**
       * @param {number} offset
       * @return {ContentEmbed}
       */
      splice (offset) {
        throw methodUnimplemented()
      }

      /**
       * @param {ContentEmbed} right
       * @return {boolean}
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {}
      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeJSON(this.embed);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 5
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentEmbed}
     */
    const readContentEmbed = decoder => new ContentEmbed(decoder.readJSON());

    /**
     * @private
     */
    class ContentFormat {
      /**
       * @param {string} key
       * @param {Object} value
       */
      constructor (key, value) {
        this.key = key;
        this.value = value;
      }

      /**
       * @return {number}
       */
      getLength () {
        return 1
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return []
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return false
      }

      /**
       * @return {ContentFormat}
       */
      copy () {
        return new ContentFormat(this.key, this.value)
      }

      /**
       * @param {number} offset
       * @return {ContentFormat}
       */
      splice (offset) {
        throw methodUnimplemented()
      }

      /**
       * @param {ContentFormat} right
       * @return {boolean}
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {
        // @todo searchmarker are currently unsupported for rich text documents
        /** @type {AbstractType<any>} */ (item.parent)._searchMarker = null;
      }

      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeKey(this.key);
        encoder.writeJSON(this.value);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 6
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentFormat}
     */
    const readContentFormat = decoder => new ContentFormat(decoder.readString(), decoder.readJSON());

    /**
     * @private
     */
    class ContentJSON {
      /**
       * @param {Array<any>} arr
       */
      constructor (arr) {
        /**
         * @type {Array<any>}
         */
        this.arr = arr;
      }

      /**
       * @return {number}
       */
      getLength () {
        return this.arr.length
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return this.arr
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentJSON}
       */
      copy () {
        return new ContentJSON(this.arr)
      }

      /**
       * @param {number} offset
       * @return {ContentJSON}
       */
      splice (offset) {
        const right = new ContentJSON(this.arr.slice(offset));
        this.arr = this.arr.slice(0, offset);
        return right
      }

      /**
       * @param {ContentJSON} right
       * @return {boolean}
       */
      mergeWith (right) {
        this.arr = this.arr.concat(right.arr);
        return true
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {}
      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        const len = this.arr.length;
        encoder.writeLen(len - offset);
        for (let i = offset; i < len; i++) {
          const c = this.arr[i];
          encoder.writeString(c === undefined ? 'undefined' : JSON.stringify(c));
        }
      }

      /**
       * @return {number}
       */
      getRef () {
        return 2
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentJSON}
     */
    const readContentJSON = decoder => {
      const len = decoder.readLen();
      const cs = [];
      for (let i = 0; i < len; i++) {
        const c = decoder.readString();
        if (c === 'undefined') {
          cs.push(undefined);
        } else {
          cs.push(JSON.parse(c));
        }
      }
      return new ContentJSON(cs)
    };

    class ContentAny {
      /**
       * @param {Array<any>} arr
       */
      constructor (arr) {
        /**
         * @type {Array<any>}
         */
        this.arr = arr;
      }

      /**
       * @return {number}
       */
      getLength () {
        return this.arr.length
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return this.arr
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentAny}
       */
      copy () {
        return new ContentAny(this.arr)
      }

      /**
       * @param {number} offset
       * @return {ContentAny}
       */
      splice (offset) {
        const right = new ContentAny(this.arr.slice(offset));
        this.arr = this.arr.slice(0, offset);
        return right
      }

      /**
       * @param {ContentAny} right
       * @return {boolean}
       */
      mergeWith (right) {
        this.arr = this.arr.concat(right.arr);
        return true
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {}
      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        const len = this.arr.length;
        encoder.writeLen(len - offset);
        for (let i = offset; i < len; i++) {
          const c = this.arr[i];
          encoder.writeAny(c);
        }
      }

      /**
       * @return {number}
       */
      getRef () {
        return 8
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentAny}
     */
    const readContentAny = decoder => {
      const len = decoder.readLen();
      const cs = [];
      for (let i = 0; i < len; i++) {
        cs.push(decoder.readAny());
      }
      return new ContentAny(cs)
    };

    /**
     * @private
     */
    class ContentString {
      /**
       * @param {string} str
       */
      constructor (str) {
        /**
         * @type {string}
         */
        this.str = str;
      }

      /**
       * @return {number}
       */
      getLength () {
        return this.str.length
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return this.str.split('')
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentString}
       */
      copy () {
        return new ContentString(this.str)
      }

      /**
       * @param {number} offset
       * @return {ContentString}
       */
      splice (offset) {
        const right = new ContentString(this.str.slice(offset));
        this.str = this.str.slice(0, offset);
        return right
      }

      /**
       * @param {ContentString} right
       * @return {boolean}
       */
      mergeWith (right) {
        this.str += right.str;
        return true
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {}
      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {}
      /**
       * @param {StructStore} store
       */
      gc (store) {}
      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        encoder.writeString(offset === 0 ? this.str : this.str.slice(offset));
      }

      /**
       * @return {number}
       */
      getRef () {
        return 4
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentString}
     */
    const readContentString = decoder => new ContentString(decoder.readString());

    /**
     * @type {Array<function(AbstractUpdateDecoder):AbstractType<any>>}
     * @private
     */
    const typeRefs = [
      readYArray,
      readYMap,
      readYText,
      readYXmlElement,
      readYXmlFragment,
      readYXmlHook,
      readYXmlText
    ];

    const YArrayRefID = 0;
    const YMapRefID = 1;
    const YTextRefID = 2;
    const YXmlElementRefID = 3;
    const YXmlFragmentRefID = 4;
    const YXmlHookRefID = 5;
    const YXmlTextRefID = 6;

    /**
     * @private
     */
    class ContentType {
      /**
       * @param {AbstractType<YEvent>} type
       */
      constructor (type) {
        /**
         * @type {AbstractType<any>}
         */
        this.type = type;
      }

      /**
       * @return {number}
       */
      getLength () {
        return 1
      }

      /**
       * @return {Array<any>}
       */
      getContent () {
        return [this.type]
      }

      /**
       * @return {boolean}
       */
      isCountable () {
        return true
      }

      /**
       * @return {ContentType}
       */
      copy () {
        return new ContentType(this.type._copy())
      }

      /**
       * @param {number} offset
       * @return {ContentType}
       */
      splice (offset) {
        throw methodUnimplemented()
      }

      /**
       * @param {ContentType} right
       * @return {boolean}
       */
      mergeWith (right) {
        return false
      }

      /**
       * @param {Transaction} transaction
       * @param {Item} item
       */
      integrate (transaction, item) {
        this.type._integrate(transaction.doc, item);
      }

      /**
       * @param {Transaction} transaction
       */
      delete (transaction) {
        let item = this.type._start;
        while (item !== null) {
          if (!item.deleted) {
            item.delete(transaction);
          } else {
            // Whis will be gc'd later and we want to merge it if possible
            // We try to merge all deleted items after each transaction,
            // but we have no knowledge about that this needs to be merged
            // since it is not in transaction.ds. Hence we add it to transaction._mergeStructs
            transaction._mergeStructs.push(item);
          }
          item = item.right;
        }
        this.type._map.forEach(item => {
          if (!item.deleted) {
            item.delete(transaction);
          } else {
            // same as above
            transaction._mergeStructs.push(item);
          }
        });
        transaction.changed.delete(this.type);
      }

      /**
       * @param {StructStore} store
       */
      gc (store) {
        let item = this.type._start;
        while (item !== null) {
          item.gc(store, true);
          item = item.right;
        }
        this.type._start = null;
        this.type._map.forEach(/** @param {Item | null} item */ (item) => {
          while (item !== null) {
            item.gc(store, true);
            item = item.left;
          }
        });
        this.type._map = new Map();
      }

      /**
       * @param {AbstractUpdateEncoder} encoder
       * @param {number} offset
       */
      write (encoder, offset) {
        this.type._write(encoder);
      }

      /**
       * @return {number}
       */
      getRef () {
        return 7
      }
    }

    /**
     * @private
     *
     * @param {AbstractUpdateDecoder} decoder
     * @return {ContentType}
     */
    const readContentType = decoder => new ContentType(typeRefs[decoder.readTypeRef()](decoder));

    /**
     * @todo This should return several items
     *
     * @param {StructStore} store
     * @param {ID} id
     * @return {{item:Item, diff:number}}
     */
    const followRedone = (store, id) => {
      /**
       * @type {ID|null}
       */
      let nextID = id;
      let diff = 0;
      let item;
      do {
        if (diff > 0) {
          nextID = createID(nextID.client, nextID.clock + diff);
        }
        item = getItem(store, nextID);
        diff = nextID.clock - item.id.clock;
        nextID = item.redone;
      } while (nextID !== null && item instanceof Item)
      return {
        item, diff
      }
    };

    /**
     * Make sure that neither item nor any of its parents is ever deleted.
     *
     * This property does not persist when storing it into a database or when
     * sending it to other peers
     *
     * @param {Item|null} item
     * @param {boolean} keep
     */
    const keepItem = (item, keep) => {
      while (item !== null && item.keep !== keep) {
        item.keep = keep;
        item = /** @type {AbstractType<any>} */ (item.parent)._item;
      }
    };

    /**
     * Split leftItem into two items
     * @param {Transaction} transaction
     * @param {Item} leftItem
     * @param {number} diff
     * @return {Item}
     *
     * @function
     * @private
     */
    const splitItem = (transaction, leftItem, diff) => {
      // create rightItem
      const { client, clock } = leftItem.id;
      const rightItem = new Item(
        createID(client, clock + diff),
        leftItem,
        createID(client, clock + diff - 1),
        leftItem.right,
        leftItem.rightOrigin,
        leftItem.parent,
        leftItem.parentSub,
        leftItem.content.splice(diff)
      );
      if (leftItem.deleted) {
        rightItem.markDeleted();
      }
      if (leftItem.keep) {
        rightItem.keep = true;
      }
      if (leftItem.redone !== null) {
        rightItem.redone = createID(leftItem.redone.client, leftItem.redone.clock + diff);
      }
      // update left (do not set leftItem.rightOrigin as it will lead to problems when syncing)
      leftItem.right = rightItem;
      // update right
      if (rightItem.right !== null) {
        rightItem.right.left = rightItem;
      }
      // right is more specific.
      transaction._mergeStructs.push(rightItem);
      // update parent._map
      if (rightItem.parentSub !== null && rightItem.right === null) {
        /** @type {AbstractType<any>} */ (rightItem.parent)._map.set(rightItem.parentSub, rightItem);
      }
      leftItem.length = diff;
      return rightItem
    };

    /**
     * Redoes the effect of this operation.
     *
     * @param {Transaction} transaction The Yjs instance.
     * @param {Item} item
     * @param {Set<Item>} redoitems
     *
     * @return {Item|null}
     *
     * @private
     */
    const redoItem = (transaction, item, redoitems) => {
      const doc = transaction.doc;
      const store = doc.store;
      const ownClientID = doc.clientID;
      const redone = item.redone;
      if (redone !== null) {
        return getItemCleanStart(transaction, redone)
      }
      let parentItem = /** @type {AbstractType<any>} */ (item.parent)._item;
      /**
       * @type {Item|null}
       */
      let left;
      /**
       * @type {Item|null}
       */
      let right;
      if (item.parentSub === null) {
        // Is an array item. Insert at the old position
        left = item.left;
        right = item;
      } else {
        // Is a map item. Insert as current value
        left = item;
        while (left.right !== null) {
          left = left.right;
          if (left.id.client !== ownClientID) {
            // It is not possible to redo this item because it conflicts with a
            // change from another client
            return null
          }
        }
        if (left.right !== null) {
          left = /** @type {Item} */ (/** @type {AbstractType<any>} */ (item.parent)._map.get(item.parentSub));
        }
        right = null;
      }
      // make sure that parent is redone
      if (parentItem !== null && parentItem.deleted === true && parentItem.redone === null) {
        // try to undo parent if it will be undone anyway
        if (!redoitems.has(parentItem) || redoItem(transaction, parentItem, redoitems) === null) {
          return null
        }
      }
      if (parentItem !== null && parentItem.redone !== null) {
        while (parentItem.redone !== null) {
          parentItem = getItemCleanStart(transaction, parentItem.redone);
        }
        // find next cloned_redo items
        while (left !== null) {
          /**
           * @type {Item|null}
           */
          let leftTrace = left;
          // trace redone until parent matches
          while (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item !== parentItem) {
            leftTrace = leftTrace.redone === null ? null : getItemCleanStart(transaction, leftTrace.redone);
          }
          if (leftTrace !== null && /** @type {AbstractType<any>} */ (leftTrace.parent)._item === parentItem) {
            left = leftTrace;
            break
          }
          left = left.left;
        }
        while (right !== null) {
          /**
           * @type {Item|null}
           */
          let rightTrace = right;
          // trace redone until parent matches
          while (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item !== parentItem) {
            rightTrace = rightTrace.redone === null ? null : getItemCleanStart(transaction, rightTrace.redone);
          }
          if (rightTrace !== null && /** @type {AbstractType<any>} */ (rightTrace.parent)._item === parentItem) {
            right = rightTrace;
            break
          }
          right = right.right;
        }
      }
      const nextClock = getState(store, ownClientID);
      const nextId = createID(ownClientID, nextClock);
      const redoneItem = new Item(
        nextId,
        left, left && left.lastId,
        right, right && right.id,
        parentItem === null ? item.parent : /** @type {ContentType} */ (parentItem.content).type,
        item.parentSub,
        item.content.copy()
      );
      item.redone = nextId;
      keepItem(redoneItem, true);
      redoneItem.integrate(transaction, 0);
      return redoneItem
    };

    /**
     * Abstract class that represents any content.
     */
    class Item extends AbstractStruct {
      /**
       * @param {ID} id
       * @param {Item | null} left
       * @param {ID | null} origin
       * @param {Item | null} right
       * @param {ID | null} rightOrigin
       * @param {AbstractType<any>|ID|null} parent Is a type if integrated, is null if it is possible to copy parent from left or right, is ID before integration to search for it.
       * @param {string | null} parentSub
       * @param {AbstractContent} content
       */
      constructor (id, left, origin, right, rightOrigin, parent, parentSub, content) {
        super(id, content.getLength());
        /**
         * The item that was originally to the left of this item.
         * @type {ID | null}
         */
        this.origin = origin;
        /**
         * The item that is currently to the left of this item.
         * @type {Item | null}
         */
        this.left = left;
        /**
         * The item that is currently to the right of this item.
         * @type {Item | null}
         */
        this.right = right;
        /**
         * The item that was originally to the right of this item.
         * @type {ID | null}
         */
        this.rightOrigin = rightOrigin;
        /**
         * @type {AbstractType<any>|ID|null}
         */
        this.parent = parent;
        /**
         * If the parent refers to this item with some kind of key (e.g. YMap, the
         * key is specified here. The key is then used to refer to the list in which
         * to insert this item. If `parentSub = null` type._start is the list in
         * which to insert to. Otherwise it is `parent._map`.
         * @type {String | null}
         */
        this.parentSub = parentSub;
        /**
         * If this type's effect is reundone this type refers to the type that undid
         * this operation.
         * @type {ID | null}
         */
        this.redone = null;
        /**
         * @type {AbstractContent}
         */
        this.content = content;
        /**
         * bit1: keep
         * bit2: countable
         * bit3: deleted
         * bit4: mark - mark node as fast-search-marker
         * @type {number} byte
         */
        this.info = this.content.isCountable() ? BIT2 : 0;
      }

      /**
       * This is used to mark the item as an indexed fast-search marker
       *
       * @type {boolean}
       */
      set marker (isMarked) {
        if (((this.info & BIT4) > 0) !== isMarked) {
          this.info ^= BIT4;
        }
      }

      get marker () {
        return (this.info & BIT4) > 0
      }

      /**
       * If true, do not garbage collect this Item.
       */
      get keep () {
        return (this.info & BIT1) > 0
      }

      set keep (doKeep) {
        if (this.keep !== doKeep) {
          this.info ^= BIT1;
        }
      }

      get countable () {
        return (this.info & BIT2) > 0
      }

      /**
       * Whether this item was deleted or not.
       * @type {Boolean}
       */
      get deleted () {
        return (this.info & BIT3) > 0
      }

      set deleted (doDelete) {
        if (this.deleted !== doDelete) {
          this.info ^= BIT3;
        }
      }

      markDeleted () {
        this.info |= BIT3;
      }

      /**
       * Return the creator clientID of the missing op or define missing items and return null.
       *
       * @param {Transaction} transaction
       * @param {StructStore} store
       * @return {null | number}
       */
      getMissing (transaction, store) {
        if (this.origin && this.origin.client !== this.id.client && this.origin.clock >= getState(store, this.origin.client)) {
          return this.origin.client
        }
        if (this.rightOrigin && this.rightOrigin.client !== this.id.client && this.rightOrigin.clock >= getState(store, this.rightOrigin.client)) {
          return this.rightOrigin.client
        }
        if (this.parent && this.parent.constructor === ID && this.id.client !== this.parent.client && this.parent.clock >= getState(store, this.parent.client)) {
          return this.parent.client
        }

        // We have all missing ids, now find the items

        if (this.origin) {
          this.left = getItemCleanEnd(transaction, store, this.origin);
          this.origin = this.left.lastId;
        }
        if (this.rightOrigin) {
          this.right = getItemCleanStart(transaction, this.rightOrigin);
          this.rightOrigin = this.right.id;
        }
        if ((this.left && this.left.constructor === GC) || (this.right && this.right.constructor === GC)) {
          this.parent = null;
        }
        // only set parent if this shouldn't be garbage collected
        if (!this.parent) {
          if (this.left && this.left.constructor === Item) {
            this.parent = this.left.parent;
            this.parentSub = this.left.parentSub;
          }
          if (this.right && this.right.constructor === Item) {
            this.parent = this.right.parent;
            this.parentSub = this.right.parentSub;
          }
        } else if (this.parent.constructor === ID) {
          const parentItem = getItem(store, this.parent);
          if (parentItem.constructor === GC) {
            this.parent = null;
          } else {
            this.parent = /** @type {ContentType} */ (parentItem.content).type;
          }
        }
        return null
      }

      /**
       * @param {Transaction} transaction
       * @param {number} offset
       */
      integrate (transaction, offset) {
        if (offset > 0) {
          this.id.clock += offset;
          this.left = getItemCleanEnd(transaction, transaction.doc.store, createID(this.id.client, this.id.clock - 1));
          this.origin = this.left.lastId;
          this.content = this.content.splice(offset);
          this.length -= offset;
        }

        if (this.parent) {
          if ((!this.left && (!this.right || this.right.left !== null)) || (this.left && this.left.right !== this.right)) {
            /**
             * @type {Item|null}
             */
            let left = this.left;

            /**
             * @type {Item|null}
             */
            let o;
            // set o to the first conflicting item
            if (left !== null) {
              o = left.right;
            } else if (this.parentSub !== null) {
              o = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null;
              while (o !== null && o.left !== null) {
                o = o.left;
              }
            } else {
              o = /** @type {AbstractType<any>} */ (this.parent)._start;
            }
            // TODO: use something like DeleteSet here (a tree implementation would be best)
            // @todo use global set definitions
            /**
             * @type {Set<Item>}
             */
            const conflictingItems = new Set();
            /**
             * @type {Set<Item>}
             */
            const itemsBeforeOrigin = new Set();
            // Let c in conflictingItems, b in itemsBeforeOrigin
            // ***{origin}bbbb{this}{c,b}{c,b}{o}***
            // Note that conflictingItems is a subset of itemsBeforeOrigin
            while (o !== null && o !== this.right) {
              itemsBeforeOrigin.add(o);
              conflictingItems.add(o);
              if (compareIDs(this.origin, o.origin)) {
                // case 1
                if (o.id.client < this.id.client) {
                  left = o;
                  conflictingItems.clear();
                } else if (compareIDs(this.rightOrigin, o.rightOrigin)) {
                  // this and o are conflicting and point to the same integration points. The id decides which item comes first.
                  // Since this is to the left of o, we can break here
                  break
                } // else, o might be integrated before an item that this conflicts with. If so, we will find it in the next iterations
              } else if (o.origin !== null && itemsBeforeOrigin.has(getItem(transaction.doc.store, o.origin))) { // use getItem instead of getItemCleanEnd because we don't want / need to split items.
                // case 2
                if (!conflictingItems.has(getItem(transaction.doc.store, o.origin))) {
                  left = o;
                  conflictingItems.clear();
                }
              } else {
                break
              }
              o = o.right;
            }
            this.left = left;
          }
          // reconnect left/right + update parent map/start if necessary
          if (this.left !== null) {
            const right = this.left.right;
            this.right = right;
            this.left.right = this;
          } else {
            let r;
            if (this.parentSub !== null) {
              r = /** @type {AbstractType<any>} */ (this.parent)._map.get(this.parentSub) || null;
              while (r !== null && r.left !== null) {
                r = r.left;
              }
            } else {
              r = /** @type {AbstractType<any>} */ (this.parent)._start
              ;/** @type {AbstractType<any>} */ (this.parent)._start = this;
            }
            this.right = r;
          }
          if (this.right !== null) {
            this.right.left = this;
          } else if (this.parentSub !== null) {
            // set as current parent value if right === null and this is parentSub
            /** @type {AbstractType<any>} */ (this.parent)._map.set(this.parentSub, this);
            if (this.left !== null) {
              // this is the current attribute value of parent. delete right
              this.left.delete(transaction);
            }
          }
          // adjust length of parent
          if (this.parentSub === null && this.countable && !this.deleted) {
            /** @type {AbstractType<any>} */ (this.parent)._length += this.length;
          }
          addStruct(transaction.doc.store, this);
          this.content.integrate(transaction, this);
          // add parent to transaction.changed
          addChangedTypeToTransaction(transaction, /** @type {AbstractType<any>} */ (this.parent), this.parentSub);
          if ((/** @type {AbstractType<any>} */ (this.parent)._item !== null && /** @type {AbstractType<any>} */ (this.parent)._item.deleted) || (this.parentSub !== null && this.right !== null)) {
            // delete if parent is deleted or if this is not the current attribute value of parent
            this.delete(transaction);
          }
        } else {
          // parent is not defined. Integrate GC struct instead
          new GC(this.id, this.length).integrate(transaction, 0);
        }
      }

      /**
       * Returns the next non-deleted item
       */
      get next () {
        let n = this.right;
        while (n !== null && n.deleted) {
          n = n.right;
        }
        return n
      }

      /**
       * Returns the previous non-deleted item
       */
      get prev () {
        let n = this.left;
        while (n !== null && n.deleted) {
          n = n.left;
        }
        return n
      }

      /**
       * Computes the last content address of this Item.
       */
      get lastId () {
        // allocating ids is pretty costly because of the amount of ids created, so we try to reuse whenever possible
        return this.length === 1 ? this.id : createID(this.id.client, this.id.clock + this.length - 1)
      }

      /**
       * Try to merge two items
       *
       * @param {Item} right
       * @return {boolean}
       */
      mergeWith (right) {
        if (
          compareIDs(right.origin, this.lastId) &&
          this.right === right &&
          compareIDs(this.rightOrigin, right.rightOrigin) &&
          this.id.client === right.id.client &&
          this.id.clock + this.length === right.id.clock &&
          this.deleted === right.deleted &&
          this.redone === null &&
          right.redone === null &&
          this.content.constructor === right.content.constructor &&
          this.content.mergeWith(right.content)
        ) {
          if (right.keep) {
            this.keep = true;
          }
          this.right = right.right;
          if (this.right !== null) {
            this.right.left = this;
          }
          this.length += right.length;
          return true
        }
        return false
      }

      /**
       * Mark this Item as deleted.
       *
       * @param {Transaction} transaction
       */
      delete (transaction) {
        if (!this.deleted) {
          const parent = /** @type {AbstractType<any>} */ (this.parent);
          // adjust the length of parent
          if (this.countable && this.parentSub === null) {
            parent._length -= this.length;
          }
          this.markDeleted();
          addToDeleteSet(transaction.deleteSet, this.id.client, this.id.clock, this.length);
          setIfUndefined(transaction.changed, parent, create$1).add(this.parentSub);
          this.content.delete(transaction);
        }
      }

      /**
       * @param {StructStore} store
       * @param {boolean} parentGCd
       */
      gc (store, parentGCd) {
        if (!this.deleted) {
          throw unexpectedCase()
        }
        this.content.gc(store);
        if (parentGCd) {
          replaceStruct(store, this, new GC(this.id, this.length));
        } else {
          this.content = new ContentDeleted(this.length);
        }
      }

      /**
       * Transform the properties of this type to binary and write it to an
       * BinaryEncoder.
       *
       * This is called when this Item is sent to a remote peer.
       *
       * @param {AbstractUpdateEncoder} encoder The encoder to write data to.
       * @param {number} offset
       */
      write (encoder, offset) {
        const origin = offset > 0 ? createID(this.id.client, this.id.clock + offset - 1) : this.origin;
        const rightOrigin = this.rightOrigin;
        const parentSub = this.parentSub;
        const info = (this.content.getRef() & BITS5) |
          (origin === null ? 0 : BIT8) | // origin is defined
          (rightOrigin === null ? 0 : BIT7) | // right origin is defined
          (parentSub === null ? 0 : BIT6); // parentSub is non-null
        encoder.writeInfo(info);
        if (origin !== null) {
          encoder.writeLeftID(origin);
        }
        if (rightOrigin !== null) {
          encoder.writeRightID(rightOrigin);
        }
        if (origin === null && rightOrigin === null) {
          const parent = /** @type {AbstractType<any>} */ (this.parent);
          const parentItem = parent._item;
          if (parentItem === null) {
            // parent type on y._map
            // find the correct key
            const ykey = findRootTypeKey(parent);
            encoder.writeParentInfo(true); // write parentYKey
            encoder.writeString(ykey);
          } else {
            encoder.writeParentInfo(false); // write parent id
            encoder.writeLeftID(parentItem.id);
          }
          if (parentSub !== null) {
            encoder.writeString(parentSub);
          }
        }
        this.content.write(encoder, offset);
      }
    }

    /**
     * @param {AbstractUpdateDecoder} decoder
     * @param {number} info
     */
    const readItemContent = (decoder, info) => contentRefs[info & BITS5](decoder);

    /**
     * A lookup map for reading Item content.
     *
     * @type {Array<function(AbstractUpdateDecoder):AbstractContent>}
     */
    const contentRefs = [
      () => { throw unexpectedCase() }, // GC is not ItemContent
      readContentDeleted, // 1
      readContentJSON, // 2
      readContentBinary, // 3
      readContentString, // 4
      readContentEmbed, // 5
      readContentFormat, // 6
      readContentType, // 7
      readContentAny, // 8
      readContentDoc // 9
    ];

    var Y = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AbstractConnector: AbstractConnector,
        AbstractStruct: AbstractStruct,
        AbstractType: AbstractType,
        Array: YArray,
        ContentAny: ContentAny,
        ContentBinary: ContentBinary,
        ContentDeleted: ContentDeleted,
        ContentEmbed: ContentEmbed,
        ContentFormat: ContentFormat,
        ContentJSON: ContentJSON,
        ContentString: ContentString,
        ContentType: ContentType,
        Doc: Doc,
        GC: GC,
        ID: ID,
        Item: Item,
        Map: YMap,
        PermanentUserData: PermanentUserData,
        RelativePosition: RelativePosition,
        Snapshot: Snapshot,
        Text: YText,
        Transaction: Transaction,
        UndoManager: UndoManager,
        XmlElement: YXmlElement,
        XmlFragment: YXmlFragment,
        XmlHook: YXmlHook,
        XmlText: YXmlText,
        YArrayEvent: YArrayEvent,
        YEvent: YEvent,
        YMapEvent: YMapEvent,
        YTextEvent: YTextEvent,
        YXmlEvent: YXmlEvent,
        applyUpdate: applyUpdate,
        applyUpdateV2: applyUpdateV2,
        compareIDs: compareIDs,
        compareRelativePositions: compareRelativePositions,
        createAbsolutePositionFromRelativePosition: createAbsolutePositionFromRelativePosition,
        createDeleteSet: createDeleteSet,
        createDeleteSetFromStructStore: createDeleteSetFromStructStore,
        createDocFromSnapshot: createDocFromSnapshot,
        createID: createID,
        createRelativePositionFromJSON: createRelativePositionFromJSON,
        createRelativePositionFromTypeIndex: createRelativePositionFromTypeIndex,
        createSnapshot: createSnapshot,
        decodeSnapshot: decodeSnapshot,
        decodeSnapshotV2: decodeSnapshotV2,
        decodeStateVector: decodeStateVector,
        decodeStateVectorV2: decodeStateVectorV2,
        emptySnapshot: emptySnapshot,
        encodeSnapshot: encodeSnapshot,
        encodeSnapshotV2: encodeSnapshotV2,
        encodeStateAsUpdate: encodeStateAsUpdate,
        encodeStateAsUpdateV2: encodeStateAsUpdateV2,
        encodeStateVector: encodeStateVector,
        encodeStateVectorV2: encodeStateVectorV2,
        equalSnapshots: equalSnapshots,
        findRootTypeKey: findRootTypeKey,
        getState: getState,
        getTypeChildren: getTypeChildren,
        isDeleted: isDeleted,
        isParentOf: isParentOf,
        iterateDeletedStructs: iterateDeletedStructs,
        logType: logType,
        readRelativePosition: readRelativePosition,
        readUpdate: readUpdate,
        readUpdateV2: readUpdateV2,
        snapshot: snapshot,
        transact: transact,
        tryGc: tryGc,
        typeListToArraySnapshot: typeListToArraySnapshot,
        typeMapGetSnapshot: typeMapGetSnapshot,
        writeRelativePosition: writeRelativePosition
    });

    /* eslint-env browser */

    /**
     * @typedef {Object} Channel
     * @property {Set<Function>} Channel.subs
     * @property {any} Channel.bc
     */

    /**
     * @type {Map<string, Channel>}
     */
    const channels = new Map();

    class LocalStoragePolyfill {
      /**
       * @param {string} room
       */
      constructor (room) {
        this.room = room;
        /**
         * @type {null|function({data:ArrayBuffer}):void}
         */
        this.onmessage = null;
        addEventListener('storage', e => e.key === room && this.onmessage !== null && this.onmessage({ data: fromBase64(e.newValue || '') }));
      }

      /**
       * @param {ArrayBuffer} buf
       */
      postMessage (buf) {
        varStorage.setItem(this.room, toBase64(createUint8ArrayFromArrayBuffer(buf)));
      }
    }

    // Use BroadcastChannel or Polyfill
    const BC = typeof BroadcastChannel === 'undefined' ? LocalStoragePolyfill : BroadcastChannel;

    /**
     * @param {string} room
     * @return {Channel}
     */
    const getChannel = room =>
      setIfUndefined(channels, room, () => {
        const subs = new Set();
        const bc = new BC(room);
        /**
         * @param {{data:ArrayBuffer}} e
         */
        bc.onmessage = e => subs.forEach(sub => sub(e.data));
        return {
          bc, subs
        }
      });

    /**
     * Subscribe to global `publish` events.
     *
     * @function
     * @param {string} room
     * @param {function(any):any} f
     */
    const subscribe$1 = (room, f) => getChannel(room).subs.add(f);

    /**
     * Unsubscribe from `publish` global events.
     *
     * @function
     * @param {string} room
     * @param {function(any):any} f
     */
    const unsubscribe = (room, f) => getChannel(room).subs.delete(f);

    /**
     * Publish data to all subscribers (including subscribers on this tab)
     *
     * @function
     * @param {string} room
     * @param {any} data
     */
    const publish = (room, data) => {
      const c = getChannel(room);
      c.bc.postMessage(data);
      c.subs.forEach(sub => sub(data));
    };

    /**
     * @module sync-protocol
     */

    /**
     * @typedef {Map<number, number>} StateMap
     */

    /**
     * Core Yjs defines three message types:
     * • YjsSyncStep1: Includes the State Set of the sending client. When received, the client should reply with YjsSyncStep2.
     * • YjsSyncStep2: Includes all missing structs and the complete delete set. When received, the the client is assured that
     *   it received all information from the remote client.
     *
     * In a peer-to-peer network, you may want to introduce a SyncDone message type. Both parties should initiate the connection
     * with SyncStep1. When a client received SyncStep2, it should reply with SyncDone. When the local client received both
     * SyncStep2 and SyncDone, it is assured that it is synced to the remote client.
     *
     * In a client-server model, you want to handle this differently: The client should initiate the connection with SyncStep1.
     * When the server receives SyncStep1, it should reply with SyncStep2 immediately followed by SyncStep1. The client replies
     * with SyncStep2 when it receives SyncStep1. Optionally the server may send a SyncDone after it received SyncStep2, so the
     * client knows that the sync is finished.  There are two reasons for this more elaborated sync model: 1. This protocol can
     * easily be implemented on top of http and websockets. 2. The server shoul only reply to requests, and not initiate them.
     * Therefore it is necesarry that the client initiates the sync.
     *
     * Construction of a message:
     * [messageType : varUint, message definition..]
     *
     * Note: A message does not include information about the room name. This must to be handled by the upper layer protocol!
     *
     * stringify[messageType] stringifies a message definition (messageType is already read from the bufffer)
     */

    const messageYjsSyncStep1 = 0;
    const messageYjsSyncStep2 = 1;
    const messageYjsUpdate = 2;

    /**
     * Create a sync step 1 message based on the state of the current shared document.
     *
     * @param {encoding.Encoder} encoder
     * @param {Y.Doc} doc
     */
    const writeSyncStep1 = (encoder, doc) => {
      writeVarUint(encoder, messageYjsSyncStep1);
      const sv = encodeStateVector(doc);
      writeVarUint8Array(encoder, sv);
    };

    /**
     * @param {encoding.Encoder} encoder
     * @param {Y.Doc} doc
     * @param {Uint8Array} [encodedStateVector]
     */
    const writeSyncStep2 = (encoder, doc, encodedStateVector) => {
      writeVarUint(encoder, messageYjsSyncStep2);
      writeVarUint8Array(encoder, encodeStateAsUpdate(doc, encodedStateVector));
    };

    /**
     * Read SyncStep1 message and reply with SyncStep2.
     *
     * @param {decoding.Decoder} decoder The reply to the received message
     * @param {encoding.Encoder} encoder The received message
     * @param {Y.Doc} doc
     */
    const readSyncStep1 = (decoder, encoder, doc) =>
      writeSyncStep2(encoder, doc, readVarUint8Array(decoder));

    /**
     * Read and apply Structs and then DeleteStore to a y instance.
     *
     * @param {decoding.Decoder} decoder
     * @param {Y.Doc} doc
     * @param {any} transactionOrigin
     */
    const readSyncStep2 = (decoder, doc, transactionOrigin) => {
      applyUpdate(doc, readVarUint8Array(decoder), transactionOrigin);
    };

    /**
     * @param {encoding.Encoder} encoder
     * @param {Uint8Array} update
     */
    const writeUpdate = (encoder, update) => {
      writeVarUint(encoder, messageYjsUpdate);
      writeVarUint8Array(encoder, update);
    };

    /**
     * Read and apply Structs and then DeleteStore to a y instance.
     *
     * @param {decoding.Decoder} decoder
     * @param {Y.Doc} doc
     * @param {any} transactionOrigin
     */
    const readUpdate$1 = readSyncStep2;

    /**
     * @param {decoding.Decoder} decoder A message received from another client
     * @param {encoding.Encoder} encoder The reply message. Will not be sent if empty.
     * @param {Y.Doc} doc
     * @param {any} transactionOrigin
     */
    const readSyncMessage = (decoder, encoder, doc, transactionOrigin) => {
      const messageType = readVarUint(decoder);
      switch (messageType) {
        case messageYjsSyncStep1:
          readSyncStep1(decoder, encoder, doc);
          break
        case messageYjsSyncStep2:
          readSyncStep2(decoder, doc, transactionOrigin);
          break
        case messageYjsUpdate:
          readUpdate$1(decoder, doc, transactionOrigin);
          break
        default:
          throw new Error('Unknown message type')
      }
      return messageType
    };

    const messagePermissionDenied = 0;

    /**
     * @callback PermissionDeniedHandler
     * @param {any} y
     * @param {string} reason
     */

    /**
     *
     * @param {decoding.Decoder} decoder
     * @param {Y.Doc} y
     * @param {PermissionDeniedHandler} permissionDeniedHandler
     */
    const readAuthMessage = (decoder, y, permissionDeniedHandler) => {
      switch (readVarUint(decoder)) {
        case messagePermissionDenied: permissionDeniedHandler(y, readVarString(decoder));
      }
    };

    /**
     * @module awareness-protocol
     */

    const outdatedTimeout = 30000;

    /**
     * @typedef {Object} MetaClientState
     * @property {number} MetaClientState.clock
     * @property {number} MetaClientState.lastUpdated unix timestamp
     */

    /**
     * The Awareness class implements a simple shared state protocol that can be used for non-persistent data like awareness information
     * (cursor, username, status, ..). Each client can update its own local state and listen to state changes of
     * remote clients. Every client may set a state of a remote peer to `null` to mark the client as offline.
     *
     * Each client is identified by a unique client id (something we borrow from `doc.clientID`). A client can override
     * its own state by propagating a message with an increasing timestamp (`clock`). If such a message is received, it is
     * applied if the known state of that client is older than the new state (`clock < newClock`). If a client thinks that
     * a remote client is offline, it may propagate a message with
     * `{ clock: currentClientClock, state: null, client: remoteClient }`. If such a
     * message is received, and the known clock of that client equals the received clock, it will override the state with `null`.
     *
     * Before a client disconnects, it should propagate a `null` state with an updated clock.
     *
     * Awareness states must be updated every 30 seconds. Otherwise the Awareness instance will delete the client state.
     *
     * @extends {Observable<string>}
     */
    class Awareness extends Observable {
      /**
       * @param {Y.Doc} doc
       */
      constructor (doc) {
        super();
        this.doc = doc;
        /**
         * Maps from client id to client state
         * @type {Map<number, Object<string, any>>}
         */
        this.states = new Map();
        /**
         * @type {Map<number, MetaClientState>}
         */
        this.meta = new Map();
        this._checkInterval = setInterval(() => {
          const now = getUnixTime();
          if (this.getLocalState() !== null && (outdatedTimeout / 2 <= now - /** @type {{lastUpdated:number}} */ (this.meta.get(doc.clientID)).lastUpdated)) {
            // renew local clock
            this.setLocalState(this.getLocalState());
          }
          /**
           * @type {Array<number>}
           */
          const remove = [];
          this.meta.forEach((meta, clientid) => {
            if (clientid !== doc.clientID && outdatedTimeout <= now - meta.lastUpdated && this.states.has(clientid)) {
              remove.push(clientid);
            }
          });
          if (remove.length > 0) {
            removeAwarenessStates(this, remove, 'timeout');
          }
        }, floor(outdatedTimeout / 10));
        doc.on('destroy', () => {
          this.destroy();
        });
        this.setLocalState({});
      }
      destroy () {
        super.destroy();
        clearInterval(this._checkInterval);
      }
      /**
       * @return {Object<string,any>|null}
       */
      getLocalState () {
        return this.states.get(this.doc.clientID) || null
      }
      /**
       * @param {Object<string,any>|null} state
       */
      setLocalState (state) {
        const clientID = this.doc.clientID;
        const currLocalMeta = this.meta.get(clientID);
        const clock = currLocalMeta === undefined ? 0 : currLocalMeta.clock + 1;
        const prevState = this.states.get(clientID);
        if (state === null) {
          this.states.delete(clientID);
        } else {
          this.states.set(clientID, state);
        }
        this.meta.set(clientID, {
          clock,
          lastUpdated: getUnixTime()
        });
        const added = [];
        const updated = [];
        const filteredUpdated = [];
        const removed = [];
        if (state === null) {
          removed.push(clientID);
        } else if (prevState == null) {
          if (state != null) {
            added.push(clientID);
          }
        } else {
          updated.push(clientID);
          if (!equalityDeep(prevState, state)) {
            filteredUpdated.push(clientID);
          }
        }
        if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
          this.emit('change', [{ added, updated: filteredUpdated, removed }, 'local']);
        }
        this.emit('update', [{ added, updated, removed }, 'local']);
      }
      /**
       * @param {string} field
       * @param {any} value
       */
      setLocalStateField (field, value) {
        const state = this.getLocalState();
        if (state !== null) {
          state[field] = value;
          this.setLocalState(state);
        }
      }
      /**
       * @return {Map<number,Object<string,any>>}
       */
      getStates () {
        return this.states
      }
    }

    /**
     * Mark (remote) clients as inactive and remove them from the list of active peers.
     * This change will be propagated to remote clients.
     *
     * @param {Awareness} awareness
     * @param {Array<number>} clients
     * @param {any} origin
     */
    const removeAwarenessStates = (awareness, clients, origin) => {
      const removed = [];
      for (let i = 0; i < clients.length; i++) {
        const clientID = clients[i];
        if (awareness.states.has(clientID)) {
          awareness.states.delete(clientID);
          if (clientID === awareness.doc.clientID) {
            const curMeta = /** @type {MetaClientState} */ (awareness.meta.get(clientID));
            awareness.meta.set(clientID, {
              clock: curMeta.clock + 1,
              lastUpdated: getUnixTime()
            });
          }
          removed.push(clientID);
        }
      }
      if (removed.length > 0) {
        awareness.emit('change', [{ added: [], updated: [], removed }, origin]);
        awareness.emit('update', [{ added: [], updated: [], removed }, origin]);
      }
    };

    /**
     * @param {Awareness} awareness
     * @param {Array<number>} clients
     * @return {Uint8Array}
     */
    const encodeAwarenessUpdate = (awareness, clients, states = awareness.states) => {
      const len = clients.length;
      const encoder = createEncoder();
      writeVarUint(encoder, len);
      for (let i = 0; i < len; i++) {
        const clientID = clients[i];
        const state = states.get(clientID) || null;
        const clock = /** @type {MetaClientState} */ (awareness.meta.get(clientID)).clock;
        writeVarUint(encoder, clientID);
        writeVarUint(encoder, clock);
        writeVarString(encoder, JSON.stringify(state));
      }
      return toUint8Array(encoder)
    };

    /**
     * @param {Awareness} awareness
     * @param {Uint8Array} update
     * @param {any} origin This will be added to the emitted change event
     */
    const applyAwarenessUpdate = (awareness, update, origin) => {
      const decoder = createDecoder(update);
      const timestamp = getUnixTime();
      const added = [];
      const updated = [];
      const filteredUpdated = [];
      const removed = [];
      const len = readVarUint(decoder);
      for (let i = 0; i < len; i++) {
        const clientID = readVarUint(decoder);
        let clock = readVarUint(decoder);
        const state = JSON.parse(readVarString(decoder));
        const clientMeta = awareness.meta.get(clientID);
        const prevState = awareness.states.get(clientID);
        const currClock = clientMeta === undefined ? 0 : clientMeta.clock;
        if (currClock < clock || (currClock === clock && state === null && awareness.states.has(clientID))) {
          if (state === null) {
            // never let a remote client remove this local state
            if (clientID === awareness.doc.clientID && awareness.getLocalState() != null) {
              // remote client removed the local state. Do not remote state. Broadcast a message indicating
              // that this client still exists by increasing the clock
              clock++;
            } else {
              awareness.states.delete(clientID);
            }
          } else {
            awareness.states.set(clientID, state);
          }
          awareness.meta.set(clientID, {
            clock,
            lastUpdated: timestamp
          });
          if (clientMeta === undefined && state !== null) {
            added.push(clientID);
          } else if (clientMeta !== undefined && state === null) {
            removed.push(clientID);
          } else if (state !== null) {
            if (!equalityDeep(state, prevState)) {
              filteredUpdated.push(clientID);
            }
            updated.push(clientID);
          }
        }
      }
      if (added.length > 0 || filteredUpdated.length > 0 || removed.length > 0) {
        awareness.emit('change', [{
          added, updated: filteredUpdated, removed
        }, origin]);
      }
      if (added.length > 0 || updated.length > 0 || removed.length > 0) {
        awareness.emit('update', [{
          added, updated, removed
        }, origin]);
      }
    };

    /**
     * Mutual exclude for JavaScript.
     *
     * @module mutex
     */

    /**
     * @callback mutex
     * @param {function():void} cb Only executed when this mutex is not in the current stack
     * @param {function():void} [elseCb] Executed when this mutex is in the current stack
     */

    /**
     * Creates a mutual exclude function with the following property:
     *
     * ```js
     * const mutex = createMutex()
     * mutex(() => {
     *   // This function is immediately executed
     *   mutex(() => {
     *     // This function is not executed, as the mutex is already active.
     *   })
     * })
     * ```
     *
     * @return {mutex} A mutual exclude function
     * @public
     */
    const createMutex = () => {
      let token = true;
      return (f, g) => {
        if (token) {
          token = false;
          try {
            f();
          } finally {
            token = true;
          }
        } else if (g !== undefined) {
          g();
        }
      }
    };

    /**
     * Utility module to work with urls.
     *
     * @module url
     */

    /**
     * @param {Object<string,string>} params
     * @return {string}
     */
    const encodeQueryParams = params =>
      map$1(params, (val, key) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`).join('&');

    /*
    Unlike stated in the LICENSE file, it is not necessary to include the copyright notice and permission notice when you copy code from this file.
    */

    const messageSync = 0;
    const messageQueryAwareness = 3;
    const messageAwareness = 1;
    const messageAuth = 2;

    const reconnectTimeoutBase = 1200;
    const maxReconnectTimeout = 2500;
    // @todo - this should depend on awareness.outdatedTime
    const messageReconnectTimeout = 30000;

    /**
     * @param {WebsocketProvider} provider
     * @param {string} reason
     */
    const permissionDeniedHandler = (provider, reason) => console.warn(`Permission denied to access ${provider.url}.\n${reason}`);

    /**
     * @param {WebsocketProvider} provider
     * @param {Uint8Array} buf
     * @param {boolean} emitSynced
     * @return {encoding.Encoder}
     */
    const readMessage = (provider, buf, emitSynced) => {
      const decoder = createDecoder(buf);
      const encoder = createEncoder();
      const messageType = readVarUint(decoder);
      switch (messageType) {
        case messageSync: {
          writeVarUint(encoder, messageSync);
          const syncMessageType = readSyncMessage(decoder, encoder, provider.doc, provider);
          if (emitSynced && syncMessageType === messageYjsSyncStep2 && !provider.synced) {
            provider.synced = true;
          }
          break
        }
        case messageQueryAwareness:
          writeVarUint(encoder, messageAwareness);
          writeVarUint8Array(encoder, encodeAwarenessUpdate(provider.awareness, Array.from(provider.awareness.getStates().keys())));
          break
        case messageAwareness:
          applyAwarenessUpdate(provider.awareness, readVarUint8Array(decoder), provider);
          break
        case messageAuth:
          readAuthMessage(decoder, provider.doc, permissionDeniedHandler);
          break
        default:
          console.error('Unable to compute message');
          return encoder
      }
      return encoder
    };

    /**
     * @param {WebsocketProvider} provider
     */
    const setupWS = provider => {
      if (provider.shouldConnect && provider.ws === null) {
        const websocket = new provider._WS(provider.url);
        websocket.binaryType = 'arraybuffer';
        provider.ws = websocket;
        provider.wsconnecting = true;
        provider.wsconnected = false;
        provider.synced = false;
        websocket.onmessage = event => {
          provider.wsLastMessageReceived = getUnixTime();
          const encoder = readMessage(provider, new Uint8Array(event.data), true);
          if (length(encoder) > 1) {
            websocket.send(toUint8Array(encoder));
          }
        };
        websocket.onclose = () => {
          provider.ws = null;
          provider.wsconnecting = false;
          if (provider.wsconnected) {
            provider.wsconnected = false;
            provider.synced = false;
            // update awareness (all users left)
            removeAwarenessStates(provider.awareness, Array.from(provider.awareness.getStates().keys()), provider);
            provider.emit('status', [{
              status: 'disconnected'
            }]);
          } else {
            provider.wsUnsuccessfulReconnects++;
          }
          // Start with no reconnect timeout and increase timeout by
          // log10(wsUnsuccessfulReconnects).
          // The idea is to increase reconnect timeout slowly and have no reconnect
          // timeout at the beginning (log(1) = 0)
          setTimeout(setupWS, min(log10(provider.wsUnsuccessfulReconnects + 1) * reconnectTimeoutBase, maxReconnectTimeout), provider);
        };
        websocket.onopen = () => {
          provider.wsLastMessageReceived = getUnixTime();
          provider.wsconnecting = false;
          provider.wsconnected = true;
          provider.wsUnsuccessfulReconnects = 0;
          provider.emit('status', [{
            status: 'connected'
          }]);
          // always send sync step 1 when connected
          const encoder = createEncoder();
          writeVarUint(encoder, messageSync);
          writeSyncStep1(encoder, provider.doc);
          websocket.send(toUint8Array(encoder));
          // broadcast local awareness state
          if (provider.awareness.getLocalState() !== null) {
            const encoderAwarenessState = createEncoder();
            writeVarUint(encoderAwarenessState, messageAwareness);
            writeVarUint8Array(encoderAwarenessState, encodeAwarenessUpdate(provider.awareness, [provider.doc.clientID]));
            websocket.send(toUint8Array(encoderAwarenessState));
          }
        };
      }
    };

    /**
     * @param {WebsocketProvider} provider
     * @param {ArrayBuffer} buf
     */
    const broadcastMessage = (provider, buf) => {
      if (provider.wsconnected) {
        // @ts-ignore We know that wsconnected = true
        provider.ws.send(buf);
      }
      if (provider.bcconnected) {
        provider.mux(() => {
          publish(provider.url, buf);
        });
      }
    };

    /**
     * Websocket Provider for Yjs. Creates a websocket connection to sync the shared document.
     * The document name is attached to the provided url. I.e. the following example
     * creates a websocket connection to http://localhost:1234/my-document-name
     *
     * @example
     *   import * as Y from 'yjs'
     *   import { WebsocketProvider } from 'y-websocket'
     *   const doc = new Y.Doc()
     *   const provider = new WebsocketProvider('http://localhost:1234', 'my-document-name', doc)
     *
     * @extends {Observable<string>}
     */
    class WebsocketProvider extends Observable {
      /**
       * @param {string} serverUrl
       * @param {string} roomname
       * @param {Y.Doc} doc
       * @param {object} [opts]
       * @param {boolean} [opts.connect]
       * @param {awarenessProtocol.Awareness} [opts.awareness]
       * @param {Object<string,string>} [opts.params]
       * @param {typeof WebSocket} [opts.WebSocketPolyfill] Optionall provide a WebSocket polyfill
       * @param {number} [opts.resyncInterval] Request server state every `resyncInterval` milliseconds
       */
      constructor (serverUrl, roomname, doc, { connect = true, awareness = new Awareness(doc), params = {}, WebSocketPolyfill = WebSocket, resyncInterval = -1 } = {}) {
        super();
        // ensure that url is always ends with /
        while (serverUrl[serverUrl.length - 1] === '/') {
          serverUrl = serverUrl.slice(0, serverUrl.length - 1);
        }
        const encodedParams = encodeQueryParams(params);
        this.bcChannel = serverUrl + '/' + roomname;
        this.url = serverUrl + '/' + roomname + (encodedParams.length === 0 ? '' : '?' + encodedParams);
        this.roomname = roomname;
        this.doc = doc;
        this._WS = WebSocketPolyfill;
        /**
         * @type {Object<string,Object>}
         */
        this._localAwarenessState = {};
        this.awareness = awareness;
        this.wsconnected = false;
        this.wsconnecting = false;
        this.bcconnected = false;
        this.wsUnsuccessfulReconnects = 0;
        this.mux = createMutex();
        /**
         * @type {boolean}
         */
        this._synced = false;
        /**
         * @type {WebSocket?}
         */
        this.ws = null;
        this.wsLastMessageReceived = 0;
        /**
         * Whether to connect to other peers or not
         * @type {boolean}
         */
        this.shouldConnect = connect;

        /**
         * @type {NodeJS.Timeout | number}
         */
        this._resyncInterval = 0;
        if (resyncInterval > 0) {
          this._resyncInterval = setInterval(() => {
            if (this.ws) {
              // resend sync step 1
              const encoder = createEncoder();
              writeVarUint(encoder, messageSync);
              writeSyncStep1(encoder, doc);
              this.ws.send(toUint8Array(encoder));
            }
          }, resyncInterval);
        }

        /**
         * @param {ArrayBuffer} data
         */
        this._bcSubscriber = data => {
          this.mux(() => {
            const encoder = readMessage(this, new Uint8Array(data), false);
            if (length(encoder) > 1) {
              publish(this.bcChannel, toUint8Array(encoder));
            }
          });
        };
        /**
         * Listens to Yjs updates and sends them to remote peers (ws and broadcastchannel)
         * @param {Uint8Array} update
         * @param {any} origin
         */
        this._updateHandler = (update, origin) => {
          if (origin !== this || origin === null) {
            const encoder = createEncoder();
            writeVarUint(encoder, messageSync);
            writeUpdate(encoder, update);
            broadcastMessage(this, toUint8Array(encoder));
          }
        };
        this.doc.on('update', this._updateHandler);
        /**
         * @param {any} changed
         * @param {any} origin
         */
        this._awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
          const changedClients = added.concat(updated).concat(removed);
          const encoder = createEncoder();
          writeVarUint(encoder, messageAwareness);
          writeVarUint8Array(encoder, encodeAwarenessUpdate(awareness, changedClients));
          broadcastMessage(this, toUint8Array(encoder));
        };
        window.addEventListener('beforeunload', () => {
          removeAwarenessStates(this.awareness, [doc.clientID], 'window unload');
        });
        awareness.on('update', this._awarenessUpdateHandler);
        this._checkInterval = setInterval(() => {
          if (this.wsconnected && messageReconnectTimeout < getUnixTime() - this.wsLastMessageReceived) {
            // no message received in a long time - not even your own awareness
            // updates (which are updated every 15 seconds)
            /** @type {WebSocket} */ (this.ws).close();
          }
        }, messageReconnectTimeout / 10);
        if (connect) {
          this.connect();
        }
      }

      /**
       * @type {boolean}
       */
      get synced () {
        return this._synced
      }

      set synced (state) {
        if (this._synced !== state) {
          this._synced = state;
          this.emit('sync', [state]);
        }
      }

      destroy () {
        if (this._resyncInterval !== 0) {
          clearInterval(/** @type {NodeJS.Timeout} */ (this._resyncInterval));
        }
        clearInterval(this._checkInterval);
        this.disconnect();
        this.awareness.off('update', this._awarenessUpdateHandler);
        this.doc.off('update', this._updateHandler);
        super.destroy();
      }

      connectBc () {
        if (!this.bcconnected) {
          subscribe$1(this.bcChannel, this._bcSubscriber);
          this.bcconnected = true;
        }
        // send sync step1 to bc
        this.mux(() => {
          // write sync step 1
          const encoderSync = createEncoder();
          writeVarUint(encoderSync, messageSync);
          writeSyncStep1(encoderSync, this.doc);
          publish(this.bcChannel, toUint8Array(encoderSync));
          // broadcast local state
          const encoderState = createEncoder();
          writeVarUint(encoderState, messageSync);
          writeSyncStep2(encoderState, this.doc);
          publish(this.bcChannel, toUint8Array(encoderState));
          // write queryAwareness
          const encoderAwarenessQuery = createEncoder();
          writeVarUint(encoderAwarenessQuery, messageQueryAwareness);
          publish(this.bcChannel, toUint8Array(encoderAwarenessQuery));
          // broadcast local awareness state
          const encoderAwarenessState = createEncoder();
          writeVarUint(encoderAwarenessState, messageAwareness);
          writeVarUint8Array(encoderAwarenessState, encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
          publish(this.bcChannel, toUint8Array(encoderAwarenessState));
        });
      }

      disconnectBc () {
        // broadcast message with local awareness state set to null (indicating disconnect)
        const encoder = createEncoder();
        writeVarUint(encoder, messageAwareness);
        writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, [this.doc.clientID], new Map()));
        broadcastMessage(this, toUint8Array(encoder));
        if (this.bcconnected) {
          unsubscribe(this.bcChannel, this._bcSubscriber);
          this.bcconnected = false;
        }
      }

      disconnect () {
        this.shouldConnect = false;
        this.disconnectBc();
        if (this.ws !== null) {
          this.ws.close();
        }
      }

      connect () {
        this.shouldConnect = true;
        if (!this.wsconnected && this.ws === null) {
          setupWS(this);
          this.connectBc();
        }
      }
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    	  path: basedir,
    	  exports: {},
    	  require: function (path, base) {
          return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
        }
    	}, fn(module, module.exports), module.exports;
    }

    function getCjsExportFromNamespace (n) {
    	return n && n['default'] || n;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var array = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.readable = void 0;
    function readable(arr) {
        let value = arr.toArray();
        let subs = [];
        const setValue = (newValue) => {
            if (value === newValue)
                return;
            value = newValue;
            subs.forEach((sub) => sub(value));
        };
        const observer = (event, _transaction) => {
            const target = event.target;
            setValue(target.toArray());
        };
        const subscribe = (handler) => {
            subs = [...subs, handler];
            if (subs.length === 1) {
                arr.observe(observer);
            }
            handler(value);
            return () => {
                subs = subs.filter((sub) => sub !== handler);
                if (subs.length === 0) {
                    arr.unobserve(observer);
                }
            };
        };
        return { subscribe, y: arr };
    }
    exports.readable = readable;

    });

    var map$2 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.readable = void 0;
    function readable(map) {
        let value = new Map(Object.entries(map.toJSON()));
        let subs = [];
        const setValue = (newValue) => {
            if (value === newValue)
                return;
            value = newValue;
            subs.forEach((sub) => sub(value));
        };
        const observer = (event, _transaction) => {
            const target = event.target;
            setValue(new Map(Object.entries(target.toJSON())));
        };
        const subscribe = (handler) => {
            subs = [...subs, handler];
            if (subs.length === 1) {
                map.observe(observer);
            }
            handler(value);
            return () => {
                subs = subs.filter((sub) => sub !== handler);
                if (subs.length === 0) {
                    map.unobserve(observer);
                }
            };
        };
        return { subscribe, y: map };
    }
    exports.readable = readable;

    });

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    var store = /*#__PURE__*/Object.freeze({
        __proto__: null,
        derived: derived,
        readable: readable,
        writable: writable,
        get: get_store_value
    });

    var store_1 = getCjsExportFromNamespace(store);

    var undo = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.readable = void 0;

    function readable(undoManager) {
        const stackCount = store_1.readable({ undoSize: 0, redoSize: 0 }, (set) => {
            let undoSize = 0;
            let redoSize = 0;
            const updateStackSizes = () => {
                undoSize = undoManager.undoStack.length;
                redoSize = undoManager.redoStack.length;
                set({ undoSize, redoSize });
            };
            const added = () => {
                updateStackSizes();
            };
            const popped = () => {
                updateStackSizes();
            };
            undoManager.on('stack-item-added', added);
            undoManager.on('stack-item-popped', popped);
            return () => {
                undoManager.off('stack-item-added', added);
                undoManager.off('stack-item-popped', popped);
            };
        });
        return stackCount;
    }
    exports.readable = readable;

    });

    var main = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.undo = exports.map = exports.array = void 0;
    exports.array = array;
    exports.map = map$2;
    exports.undo = undo;

    });

    /* src/ImageButton.svelte generated by Svelte v3.29.0 */
    const file = "src/ImageButton.svelte";

    function create_fragment(ctx) {
    	let button;
    	let img;
    	let img_src_value;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			img = element("img");
    			t = space();
    			if (default_slot) default_slot.c();
    			if (img.src !== (img_src_value = /*icon*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*alt*/ ctx[1]);
    			attr_dev(img, "class", "svelte-1m7ivg9");
    			add_location(img, file, 40, 2, 764);
    			attr_dev(button, "class", "svelte-1m7ivg9");
    			toggle_class(button, "disabled", /*disabled*/ ctx[2]);
    			add_location(button, file, 39, 0, 702);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, img);
    			append_dev(button, t);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*icon*/ 1 && img.src !== (img_src_value = /*icon*/ ctx[0])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*alt*/ 2) {
    				attr_dev(img, "alt", /*alt*/ ctx[1]);
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 16) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[4], dirty, null, null);
    				}
    			}

    			if (dirty & /*disabled*/ 4) {
    				toggle_class(button, "disabled", /*disabled*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ImageButton", slots, ['default']);
    	let { icon } = $$props;
    	let { alt } = $$props;
    	let { disabled = false } = $$props;
    	const dispatch = createEventDispatcher();
    	const writable_props = ["icon", "alt", "disabled"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ImageButton> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => dispatch("click");

    	$$self.$$set = $$props => {
    		if ("icon" in $$props) $$invalidate(0, icon = $$props.icon);
    		if ("alt" in $$props) $$invalidate(1, alt = $$props.alt);
    		if ("disabled" in $$props) $$invalidate(2, disabled = $$props.disabled);
    		if ("$$scope" in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		icon,
    		alt,
    		disabled,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ("icon" in $$props) $$invalidate(0, icon = $$props.icon);
    		if ("alt" in $$props) $$invalidate(1, alt = $$props.alt);
    		if ("disabled" in $$props) $$invalidate(2, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [icon, alt, disabled, dispatch, $$scope, slots, click_handler];
    }

    class ImageButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { icon: 0, alt: 1, disabled: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ImageButton",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*icon*/ ctx[0] === undefined && !("icon" in props)) {
    			console.warn("<ImageButton> was created without expected prop 'icon'");
    		}

    		if (/*alt*/ ctx[1] === undefined && !("alt" in props)) {
    			console.warn("<ImageButton> was created without expected prop 'alt'");
    		}
    	}

    	get icon() {
    		throw new Error("<ImageButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<ImageButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get alt() {
    		throw new Error("<ImageButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set alt(value) {
    		throw new Error("<ImageButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<ImageButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<ImageButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAAAXNSR0IArs4c6QAAAAlwSFlzAAEQhAABEIQBP0VFYAAABChpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjA8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjE3NzI8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjE3NzI8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj41MTI8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjE8L2V4aWY6Q29sb3JTcGFjZT4KICAgICAgICAgPGV4aWY6UGl4ZWxZRGltZW5zaW9uPjUxMjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMjAtMTAtMTZUMTM6MTA6NjA8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy45PC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgrxmt8lAABAAElEQVR4Ae3dB3gc1bnG8VeSuywX2ZZ7x7iXYIrpxkACIQnk0k1PIQkpBEggCRDCDZ2bcm8INSGE4gChmYRm4967LfcuW7J678WS7hljOS67qy2zuzO7fz2PWO3MKd/5ncX6NOWMxBcCCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAQMwKJMTsyBgYAkEKnNdLX+rVQYM7J6pHYoK6VDUquaBOW7fk69M8qSrIZqmGAAIIOEqABMBR00Ew0RI4s4dGndFD913WV1dd1FudPcWxsUzNH+do39JCzV5VqhdzqrXaUzm2IYAAAm4QIAFwwywRY9gEJnXTpGsG6t2fnqxhHZP872ZRgfS3vfpwdrFuyypXsf81KYkAAgg4QyCAf/KcETBRIGCXwHUD9av/PUVv/tcApbZNDKzVwcnS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QHaNZE4FaHWJqrdUhOcOAGuYJABRnmy6RwABBBBAoEWgvklt8swRgOL6Q0cArNv/jroioKWUPa8kAPY40goCCCCAAAIhC5iHAXUqMb/8qw5Ku21++t/xwZEAHC/CewQQQAABBKIk0DZByRXml39WtTn/X6kPwhkGdwGEU5e2EUAAAQQQ8F8gOTFBSdYRgD1V2mOqZflfNfCSJACBm1EDAQQQQACBcAh0NbcByroIcGdF+G7/awmcUwAtErwigAACCCAQXYEu1gWAuSaG/Dr9O7qh0DsCCCCAAAIIRErgjHaJajadWUsBdQx3p5wCCLcw7SOAAAIIIOCfQFdzG6D1tch8mxMB4f0iAQivL60jgAACCCDgr0DXwwVn+VshlHIkAKHoURcBBBBAAAH7BFoSgM/sa9J7SyQA3m3YgwACCCCAQCQFrATAugYwPRKdkgBEQpk+EEAAAQQQaF3ASgAicvjfCoUEoPUJoQQCCCCAAAKREOhiOiEBiIQ0fSCAAAIIIOAgASsBmB2peDgCEClp+kEAAQQQQMC3wF6zO993Efv2JtnXFC0hgAACCCCAQAgC7U1d6xkAfCGAAAIIIIBAHAm03AYYR0NmqAgggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAvEr8P+LtmtBYUik0AAAAABJRU5ErkJggg==";

    const img$1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAAAXNSR0IArs4c6QAAAAlwSFlzAAEQhAABEIQBP0VFYAAABChpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjI8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjA8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjE3NzI8L3RpZmY6WFJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgICAgIDx0aWZmOllSZXNvbHV0aW9uPjE3NzI8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj41MTI8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjE8L2V4aWY6Q29sb3JTcGFjZT4KICAgICAgICAgPGV4aWY6UGl4ZWxZRGltZW5zaW9uPjUxMjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMjAtMTAtMTZUMTM6MTA6ODk8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy45PC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgrqWMhBAABAAElEQVR4Ae3dB3wUdf7/8Te9hk5CLwooRcCKoIdgL6fnqWfX6+cV/3fenaLoz3aCBcup56GeHQW7d6hnAREUewNCCAFCSCOdkB5CSPL/LsqJuEm2zMzOzL728eCRzezM9/v5Pr9L5rOzM5+ReCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAII+FagjW9HxsAQQCDuBAZJXUcn6qSkThrfpb1q1aiyygaVltQp8/1irYo7EAaMQAsCJAAt4PASAgi4X6B/Bx18ZD9dNrW/TjxtgEZM7KWgf9feKVTVG/l6+YsSzVtZqlT3j4wIEbBXIOh/FHu7pHUEEEAgeoFhPdV7Zm89/suR+tEP+gff6QfrZUeDdO8mZb6QpZ+sKtcXwdZhGQLxINAuHgbJGBFAwF8CJw/UX24eqzdnHagJw7uFvvMPKLRvKx3dT72mJ+rXpTvVNqVcK/ylw2gQCE2AIwChObEWAgi4ROBnI/TyPw7RWd3bWxPQ31L11Us5On5tubZb0yKtIOANAY4AeGOeiBIBBIzA2UM076kj9KsuFv7lOqa/Bg7soj8U1GlFVrVygUYgXgQs/G8UL2SMEwEEYiFweF/97J+HaF5iZ+t7P7CHOh7bX78orFOt+UrgQ+t7oEUE3CdAAuC+OSEiBBDYR8Ds80fOmah3jk2U+QbfnkfPjmpjjjCcUN+oKaUlerFYMqcL8kDAvwIkAP6dW0aGgG8EfjxUD82ZoIOcGNBxSRrdoYt+vmWHXiqqVYUTfdIHArEQIAGIhTp9IoBAyAI9pd5zJumJ0Qn2ffrfN5hDe6vHmG76/dYafbmlRun7vs7vCPhBgATAD7PIGBDwscDxgzTnxvE62ukh7tdd7U8cqIsKd6hbcrmWOt0//SFgtwAJgN3CtI8AAlEJXLa/Fk3rq65RNRLhxgnmUsOzhugoc+LBKeacgOeKa7QzwqbYDAHXCdh2Qo3rRkpACCDgOYHxUsdTktQn1oHfMF5Tbhyl7BlJmhDrWOgfAasESACskqQdBBCwXKBvkg4Y1zO8Sn+WB/FNgz8Zqt6PHqY15w/VL+zqg3YRcFKABMBJbfpCAIGwBAZ00iFhbWDzyvt3U9tFU/XYVQdqoemKSqo2e9O8vQIkAPb60joCCEQh0KeDM5f+hRNiYK8/b6IufOBgpR2YoL7hbMu6CLhJgATATbNBLAgg8B2Bzm3V+zsLXPTLH0ZrzD0HK8sUJ5rmorAIBYGQBUgAQqZiRQQQcFrA3LnP1YfZTxmgbubeBB9cNEyznLahPwSiFSABiFaQ7RFAIK4FhnRVm2eO1B2zD9SbgasW4hqDwXtKgATAU9NFsAjEl4CX/kDdOlEn//FQZYzvrWHxNUuM1qsCXvr/5VVj4kYAgQgFmtq4+yuAfYf1m/01+N6J2jizn07b9zV+R8BtAiQAbpsR4kEAAU8LHJ+kTgun6fVLh+tOTw+E4H0vQALg+ylmgAgg4LTAQHP/4qem6Mqbx+uT8f3V3en+6Q+BUARIAEJRYh0EEEAgAgFKCEeAxiaOCZAAOEZNRwggEI8C/yshPES/jMfxM2b3CpAAuHduiAwBBHwisLuE8DQ9akoILzJDcnVtA5+QM4wQBEgAQkBiFQQQQCBagW9KCF/wz0O04dAE9Yu2PbZHIFoBEoBoBdkeAQQQCEPg96M0es7BypyZqKPC2IxVEbBcgATAclIaRAABBFoWONmUEF5whFZeOExXt7wmryJgnwAJgH22tIwAAgg0KxAoIbzwSN1+7Ti9RQnhZpl4wUYBEgAbcWkaAQQQaE1g7gSdRAnh1pR43Q4BEgA7VGkTAQQQCEMgUEL4vkmUEA6DjFUtECABsACRJhBAAIFoBY5LVKdFlBCOlpHtwxAgAQgDi1URQAABOwUGfFNC+Kbx+pQSwnZK03ZAgASA9wECCCDgMoEbx+uIG0cpe0aSJrgsNMLxkQAJgI8mk6EggIB/BCgh7J+5dOtISADcOjPEhQACcS+wp4TwrAP1rMHg73XcvyOsBeANZa0nrSGAAAKWCgRKCN8xUeebEsJplBC2lDbuGyMBiPu3AAAIIOAFAUoIe2GWvBUjCYC35otoEUAgjgUoIRzHk2/D0EkAbEClSQQQQMAuAUoI2yUbf+2SAMTfnDNiBBDwgUCghPCfDlfG+N4a5oPhMIQYCJAAxACdLhFAAAErBH498usSwjP66YdWtEcb8SVAAhBf881oEUDAZwKBEsLPTtNrlwzXXT4bGsOxWYAEwGZgmkcAAQTsFgiUEF4wRX+lhLDd0v5qnwTAX/PJaBBAII4FdpcQHq3s6Uk6KI4ZGHqIAiQAIUKxGgIIIOAFgZ8MUe/HD9PqC4brV16IlxhjJ0ACEDt7ekYAAQRsEQiUEF44RY9QQtgWXt80SgLgm6lkIAgggMC3ApQQ/taCZ8EFSACCu7AUAQQQ8IXAnhLCM/rraF8MiEFYJkACYBklDSGAAALuFAiUEH56it6/YJiucWeERBULARKAWKjTJwIIIOCwQKCE8KIjddvssXp7vNTR4e7pzoUCJAAunBRCQgABBOwSuPUgnRgoIXxwLw23qw/a9YYACYA35okoEUAAAcsEAiWE75ysDZQQtozUkw2RAHhy2ggaAQQQiE6AEsLR+flhaxIAP8wiY0AAAQQiENhTQvjm8fpsfH91j6AJNvGwAAmAhyeP0BFAAAErBG4Yr8NvpISwFZSeaoMEwFPTRbAIIICAPQKBEsJPmBLC5w/Tr+3pgVbdJkAC4LYZIR4EEEAgRgL7mRLC5lLBf806QM+ZENg/xGgenOqWCXZKmn4QQAABDwjsLiE8Sef98xBtODRB/TwQMiFGKEACECEcmyGAAAJ+FjAlhEfdMllZlBD27yyTAPh3bhkZAgggEJXAKQPVNVBC+KJhmh1VQ2zsSgESAFdOC0EhgAAC7hAIlBB+5kjdSglhd8yHlVGQAFipSVsIIICATwUoIey/iSUB8N+cMiIEEEDAFoFACeF5k7Tx2CSdbksHNOqoAAmAo9x0hgACCHhb4PgkdVw4Ra9ePFx3e3skRE8CwHsAAQQQQCAsgUAJYXNy4F/+NkGfHdBPCWFtzMquESABcM1UEAgCCCDgLYHrx+nwOWOUPT1JB3krcqINCJAA8D5AAAEEEIhY4Jwh6kUJ4Yj5YrohCUBM+ekcAQQQ8L7AXiWEnzejYb/ikSllojwyUYSJAAIIuFngmxLC5wZKCE/srkQ3x0psXwuQAPBOQAABBBCwTCBQQvj2g7WFEsKWkdrWEAmAbbQ0jAACCMSnACWEvTHvJADemCeiRAABBDwlsKeE8LVjtWS81NFTwcdJsCQAcTLRDBMBBBCIhcDcg3TCFYdpy8G9NDwW/dNn8wIkAM3b8AoCCCCAgAUCv9pPgyghbAGkxU2QAFgMSnMIIIAAAt8X2FNC+JLhuuf7r7IkFgIkALFQp08EEEAgDgUCJYQXTNGfKSHsjsknAXDHPBAFAgggEDcCe0oIH52oSXEzaBcOlATAhZNCSAgggIDfBQIlhJ86XF+dN0yX+X2sbh0fCYBbZ4a4EEAAAZ8LBEoIP3ukHpp1gCghHIO5JgGIATpdIoAAAgh8LbCnhPD8Q7SREsLOvitIAJz1pjcEEEAAgSACvxul/e8wJYSP7a/pQV5mkQ0CJAA2oNIkAggggED4AicPVNenpmjFhcN1bfhbs0W4AiQA4YqxPgIIIICAbQKBEsILp2judWO1dJTUybaOaJj7NvMeQAABBBBwn8Ccg3T81YcpY3IvjXBfdP6IiCMA/phHRoEAAgj4TiBQQvjOSdowM0ln+G5wLhgQCYALJoEQEEAAAQSCCwRKCC+aosWUEA7uE81SEoBo9NgWAQQQQMB2gT0lhG+eoM8P6KcE2zuMkw5IAOJkohkmAggg4HWBG8bpsLljlE0JYWtmkgTAGkdaQQABBBBwQOBsSghbpkwCYBklDSGAAAIIOCGwp4Tw1WP1gumP/ViE6MBFCMdmCCCAAAKxEwiUEL79IP2EEsKRzwEJQOR2bIkAAgggEGMBSghHPgEkAJHbsSUCCCCAgAsEAiWEFxxJCeFwp4IEIFwx1kcAAQQQcJ3A4C6UEA53UkgAwhVjfQQQQAAB1woESgjPOkxbKCHc+hSRALRuxBoIIIAAAh4S+PV+GngXJYRbnTESgFaJWAEBBGIlwB+oWMl7v9/j9pQQHqG/e3809oyA/1/2uNIqAghYINC2jQJXe/FAICKB3SWEj9AVlBAOzkcCENyFpQgg4AKBLm3VwQVhEILHBSghHHwCSQCCu7AUAQRcINCvs7q6IAxC8IFAoITwgsP11flD9VsfDMeSIZAAWMJIIwggYIdA7w7qbEe7tBmfAiO7qe2iqXqQEsJfzz/fr8Xn/wNGjUA4Am1OH6Qu3aWu5jv5zh06qYvZuLM5Nt+5bdPu553atdu9o+7UZJa1kzqZ13f/M887mkrtncwnjU5t2pjnTea5+Wn+8HQwvweWdQg8N693NP86dGinTgmmrUFd1SOpkxLMtd39RyfsbiuceFkXgVYF5m9WxsMbNDW5SkWtruzTFUgAfDqxDAuBgMAMqX2fwRrQvb2GdmqnQWZvO9DsaRPbtVX/9m3V1/zeu30b9TJ74B5meXezTnfzvXvHhA5qZ3a+7UZ3V9skPoPzZvKpwFv5qpm3XqcuL9F7Ph1ii8MiAWiRhxcRcI1Am2lJ6j+gnYb06KTBndvu3pknmR13ovnX1+zE+5gdeK/O7dWrVwf1GNpFCQf2UJcR5pAn/8ldM4cE4kKBrbVqujpZ1y/M0lwXhmdrSPxtsJWXxhFoXuC4RCX17KBxvTpqXPcO2r9Tm92fyvuY4+W9zSfznl3bq4f5Drz70K7qNqGXOiQGDqrzQAABWwSuW6tlL6zXaelSnS0duLBREgAXTgoheV9gvPlOe8AAjerTTuN6d9ZY8732/j06akSfjho8vIsSJ/dWgtmx8//P+1PNCHwk8EiG8uena9rqMmX6aFjNDoU/QM3S8AICLQq0mdFXByR20WF9Omlyz44alWC+Z+/fUQPMYfc+ZgffmU/sLfrxIgKuFFhWqJ1z03Tu8kItdmWAFgZFAmAhJk35T8B87544qL2O6NtJh/TuqImJnTXaXEo07LDe6jmET/D+m3BGhIARKNghzUrWvU9n6s9+BiEB8PPsMraQBEaYS9f2H6CDEjvo8P5ddPCAThq/XzeNPLSP+o/qLnMlGw8EEIhHgVtS9eXCAs3cUKJKP46fBMCPs8qYmhU4qp8GDemsmUldNN1c5nbIAQkac2Rfc805l7o1a8YLCMSzwMu5Kntgk2auKNZqvzmQAPhtRhnP/wRmDtD4IZ00wxyqnz4qQYcc0VvDJ/Sktvz/gHiCAAIhCWypVuO1yfrDczl6KKQNPLISCYBHJoowmxc41FSQ65GoI8y178cM7aajzaf6ieaT/kBzGN8Ul+OBAAIIRC9gqlzqmmS9NC9N55mnjdG3GPsWSABiPwdEEKbACeYwfmJ3nWEupzt5XA9NmWGupzeH83kvh+nI6gggEL5AoITwg2mallKtwvC3dtcW/NF013wQTRCBE/pr8ogE/Xhsgk6c1l8Tp/ThDnFBmFiEAAIOCbxdoJo7Ur1fQpgEwKE3DN2EJjDK3DRm1EDNGNlFp5vqd8eaT/ejzaf89qFtzVoIIICAMwKBEsLmUsEbFmVpjjM9Wt8LCYD1prQYhsBEqdugJJ1hTtL70aRemnZCkoYM78bh/DAIWRUBBGIo4OUSwiQAMXzjxGvXxw7QEaO76eLJvXTaKQM0kh1+vL4TGDcC/hB41JQQ/scmHZVcri1eGhEJgJdmy6OxHpigvub7+/Mn9dG5JyVpirnuntvaeHQuCRsBBIILeLGEMAlA8LlkaXQCbY9P0rFjuusiU03vxNMGahCFdqIDZWsEEHC/QOHXJYTvW5CpK9wfrfiu1QuT5IUYD+iqQWN76WKzw//JqQM1+ZDenLjnhXkjRgQQsF4gUEJ4QZ6OTS9VhfWtW9ciRwCss4y7lgI7/XF9dNnUPrr47KHazxTe4YEAAgggYARezlH5A+ma4eYSwiQAvFXDEhjbVQMPMDv9aWanf9YQ7b9/97A2Z2UEEEAgbgQCJYRnJ+vy53P0oBsHTQLgxllxWUzm/vYDzP3tAzv9S9jpu2xyCAcBBFwtECghbJKAl+9I07nmqatKCJMAuPqtE7vgzD3vkyb31GVH9tclZw/WKD7px24u6BkBBLwv8KApITzfZSWESQC8/76ybAQjeqnX5G66fGo/XWp2+qPZ6VtGS0MIIICAAiWEb0/VaStKtMINHCQAbpiFGMdw0gCdNrWvZp83TFPNNfvcQS/G80H3CCDgXwE3lRAmAfDv+6zFkY033+sfkaRrfjxIPz99kHq0uDIvIoAAAghYKvB/KXr3eXNDoXSpztKGw2iMBCAMLB+s2ubkATrnB/119c9G6JBB3ELXB1PKEBBAwKsCsS4hTALg1XdOGHGP761hU3vpurOG6iJTe5+r9cOwY1UEEEDAToFACeHb1uu8ZUX6j539BGubBCCYij+WtTttgC4+OlFX/nSEJgzs7I9BMQoEEEDAbwKBEsJXJev+pzP1JyfHRgLgpLYDfe3XWz2P7qmbzxuq35iSvF0c6JIuEEAAAQQsEJiTqq+eytNMp0oIkwBYMGluaCJQlvcHAzTvlyN1nrnbXns3xEQMCCCAAALhCQRKCN+frpnvF2tVeFuGvzYJQPhmrtpiYm9NmN5Xd/1qP504qRc3d3LV5BAMAgggEIGAUyWESQAimBw3bHJSko4/Jkl3mk/8kxM7uSEiYkAAAQQQsErAiRLCJABWzZZD7ZhiPZeeMVBzLxyuIQ51STcIIIAAAjESsLOEMAlAjCY1nG4PlTqMG6Y/nz9cs82Jfb3C2ZZ1EUAAAQS8LWBXCeF23mbxffRtLxmh62dN1n//coBOGZ0gLubz/ZQzQAQQQOC7AqO6q8MJA/RTc7lg09pyvffdVyP/jSMAkdvZuuUFI/TzS4fp76ZyX09bO6JxBBBAAAHPCFyXouUvpOoUK0oIkwC4bNp/NEjHXzBMT5rv+ge7LDTCQQABBBBwgcBjGSq4f5OmJZdrSzThkABEo2fhtuba/bFnDdYzVx6oQ5gUC2FpCgEEEPChwLumhPCtUZYQZl8T4zfG/t2VaEr2/mv2WJ0xgJvzxHg26B4BBBDwjkC0JYRJAGI01+Yavi7Hj9Rdv99flx3eR5yMGaN5oFsEEEDA6wK3rNOqBfmaEW4JYRIA52e+7TmDdfWv99cNJw7grH7n+ekRAQQQ8J/Ay7mmhPCm8EoIkwA4+D6Y2k/HmDP7X/jtKCU62C1dIYAAAgjEgUCghPB1yfp/z+ZofijDJQEIRSnKdQ7op4QTemnB/43TmUlcyR+lJpsjgAACCDQnECghfE2yXpmXpnPN04bm1gssJwFoSceC184coot/v58eNkUculrQHE0ggAACCCDQqsAD6cq4d6Ombq5SUXMrkwA0JxPl8kP7aeA5A7X4mrE6PMqm2BwBBBBAAIGwBZ7LVvWcdTppXaU+DLYxZ58HU4ly2YXDdPU9E/XaWUM0NMqm2BwBBBBAAIGIBCb0VMfBXXXpqgq9ua1Oefs2whGAfUWi+P2wfjrgkqF67Y+jNTqKZtgUAQQQQAABywSezFTF7FSNKqhS8d6Ntt37F55HLNDO3LTnnmePUCo7/4gN2RABBBBAwAaBn41Qj18P0/J9m+YIwL4iYf4+pY+O/OlI/ft3+2tAmJuyOgIIIIAAAo4JnPa+znujQC/s6ZAjAHskIvh54XDNXXikPmLnHwEemyCAAAIIOCpw9lDdv3eHHAHYWyPE5wf1VO9zh+odc13/ISFuwmoIIIAAAgjEXOCYFTrp/SItCQTCEYAwp+OYfpp5y0HKZucfJhyrI4AAAgjEXGBcD/10TxAkAHskQvh58XDduWiqlv1okLqHsDqrIIAAAggg4CqBI3rrxD0Btd/zhJ/NCxyYoL4XDdcy86l/UvNr8QoCCCCAAALuFpiRqH4mwsCH/0aOALQyVz/oq+PumKQsdv6tQPEyAggggIDrBUZ2k6b30eBAoCQALUzXJcP09+emaekZg2TIeCCAAAIIIOB9ga6dNTwwCr4CCDKXgxLU77LheveGcTooyMssQgABBBBAwLMCjU2qDQRPArDPFE7upclXHqiVFw3jRL99aPgVAQQQQMAHAmVVygwMgwRgr8mc0U8/vHGC/m1OksBlLxeeIoAAAgj4Q2BVmRo/q9S2wGjY0X0zpxcM0xV3TdI9g7qI4kj+eJ8zCgQQQACBfQT+m69NexaRABiJvx6gB++cpN+y59/ztuAnAggggIAfBT4u0Yt7xhXvCUDbWw/S27PH6vg9IPxEAAEEEEDAjwIrzc2Av9yuJ/aMLW4TgCFSl6sP1ueXj9b4PRj8RAABBBBAwK8CT2ZqWeEOZewZX1wmAKO6q7/51L/qFyO/LoawB4OfCCCAAAII+FHAfPpvWpKn3+49trhLAMb20Oj/G6vPzK18e+0NwXMEEEAAAQT8KnBvuv6VW6f0vccXV5UAJyRo2t8mKJmd/95vAZ4jgAACCPhZ4PoUrXolR7/bd4xxkwCYWyCecuskvXfOEHXeF4HfEUAAAQQQ8KPAfZtU8FCqjjFja9p3fO32XeDH38f31LG3T9Qbpw+i7oEf55cxIYAAAgh8X+D6tfrovrU63Jz8X/X9V+PgZkDjE3TU3Al6i51/sOlnGQIIIICA3wTyd0iXfKY75qzXUYVSdXPj83Xtmwk9ddjfxuvDHw9Rx+YAWI4AAggggIBfBN4p1I5b1+vM5UV6u7Ux+TYBOKi3DrrRnO1/Nt/5t/Ye4HUEEEAAAR8IPLxZ2fO36KjkUuWGMhxfXgZ4UIIOvOFAfcLOP5S3AOsggAACCHhdYHayXluaprOTpfpQx+K7IwAH9dR+143TmvOGcjvfUN8ErIcAAggg4E2BrBo1XpusvyzK1n3hjsBXCcDEPhpyzRitM3f26xEuBOsjgAACCCDgJYGXc1Vx70Yd+0GJvowkbt98BTC+mwbMGqNkdv6RvA3YBgEEEEDASwLmDP9VT+RqZsZ2lUcaty8SgDEJ6nfVWK29aJh6RwrBdggggAACCLhdwNzMR7PW6B8LsvTHaGP1fAIwQup8xRit+ekI9YsWg+0RQAABBBBwq8CyQu28bb3OW1ak/1gRo+cTgIvHaenv9tcgKzBoAwEEEEAAATcKPJKh/Pnpmra6TJlWxefpBOCS4brrlgk62ioM2kEAAQQQQMBtAtet1dIX1ut0cyu/Oitj8+xVAMcm6scLj9QrA7i1j5XvB9pCAAEEEHCJQE6Nmsz1/dctzNZtdoTkySMAkxI05v/G6Xl2/na8JWgTAQQQQCDWAovzVHX3Rp28skgf2hWL5xKAJKnbnw7UhzMT1cEuFNpFAAEEEEAgVgK3pir16SxNT6vUNjtj8FwC8NvxWvHzkZzxb+ebgrYRQAABBJwXKDLf8M9arUefytJvTO9NdkfgqQTg0uH6503jdZjdKLSPAAIIIICAkwIrilRvivtcai71e86pfj1zEuDMJF343BQtTOSkP6feG/SDAAIIIOCAwONbVHx/mo5eU6mNDnT3vy48kQAEbu37wGR9Nb2/PHXE4n/KPEEAAQQQQCCIwPUp+uDJVJ2YK9UGednWRa7foY7opV5XjtZ77PxtfR/QOAIIIICAgwL5tWq6KllzF2bpege7/U5Xrk8ALh2sdy4dQY3/78wavyCAAAIIeFZgSYFqb9+g05cXalksB+HqBOC8Ybri5vE6NJZA9I0AAggggIBVAg+lK/OBDZq6rloFVrUZaTuuPQdgSh8NefRwbZnQk+/9I51ctkMAAQQQcIdA4Jo+U9XvlTvSdK552uCGqFx7BMB8+n+bnb8b3iLEgAACCCAQjcCWajWanf/lz+fowWjasXpbVyYAF43Q7D+P0TirB0t7CCCAAAIIOCnwcq7KHtikmSuKtdrJfkPpy3VfARzRUyMXTNOmAxLULpQBsA4CCCCAAAJuFLglVZ8vLNBxG0pU6cb4XHcE4IKReoudvxvfKsSEAAIIIBCKQMEO6ao1uueZLP01lPVjtY6rEoCLR+imK8ZoTKww6BcBBBBAAIFoBJYVqW5Ois5ZUaLXo2nHiW1d8xXAlP4aveBwpY3prrZODJw+EEAAAQQQsFLgkQzl3rdZR63brmwr27WrLbccAWhz4VC9xc7frmmmXQQQQAABOwWuW6s3F6/XmeuknXb2Y2XbrkgALhmmW/84SvtZOTDaQgABBBBAwG6BrGo1zU7RVc9m6W67+7K6/Zh/BWAK/ox7+kitHc2hf6vnlvYQQAABBGwU+PdWVd6TphM+2KZPbezGtqZjfgTgJ0P1Ijt/2+aXhhFAAAEEbBCYm6pkU9hnxtpybbeheUeajGkC8OMhOuuvB1Dwx5GZphMEEEAAgagFiuqkWWv04FOZ+oNpLFDh17OPWCYAbS4epn95Vo7AEUAAAQTiSmB5kernrtOFy4r1kh8GHrME4OLh+utZQ9TXD4iMAQEEEEDA3wKPbVHB/A36wVcVSvfLSGOSAIyQOv9ipP7mF0TGgQACCCDgX4H/S9Hyhak6NVMyNf7884hJAjBzpO6Ymagu/mFkJAgggAACfhPYWqumq9fopoXZ/vzA6ngCMCZB/X63v37vtzcK40EAAQQQ8I/AW/mqmbdepy4v0Xv+GdV3R+J4AnDiAP3r8D5yvN/vDpvfEEAAAQQQCC7wYLo2P7RR05KrVBR8DX8sdbQQ0JF9Nfbf07RuQBc52q8/popRIIAAAgjYKRC4pu+aNXph3gZdYJ422tmXG9p29JP4WYP1DDt/N0w7MSCAAAII7C2wuVqN16foMlPS99G9l/v5uWMJwJmDdOKVB+oQP2MyNgQQQAAB7wm8mKPt8zM0fUWhUrwXfeQRO5YAnDdcT3LcP/KJYksEEEAAAesFbk7VJy8W6oR1xaqyvnV3t+hIAmB2/r86f6gGupuC6BBAAAEE4kUg31zRPytZdzyTqWviZcz7jtORBOCMAf68hnJfTH5HAAEEEHC/wNJC7bhtvc40pX3fdn+09kVoewJwYpKOvXA4n/7tm0JaRsBagcCZ0IWmAMomc1JUfq0aKurVWNeohoYmNTSaf+b1xm9+7v7dnCrd0PT18l2B5WbzwPJdZr1dZvnun3t+N9f/BH6v/+b33T/N+jsDy8xtVerbtVFD57Zq6tlR7RPaq+1+3XTqsUkaZu0IaS2eBR7erOz5W3RUcqly49khMHbbE4Dp/XVbvCMzfgScFAgc2kwt186cWtWW71R1baOqdjaqclejKszet9z8K2ts1Hbzs9TsrUt2NajYPC+qqVdB1Q4VvFqiSifjbamvZ4/Um+Z1EoCWkHgtZIHZyXptaZrOTg4knDzsTQAm99KIX+ynI3BGAIHQBZrbgdc3qNJ82i6vNztx8zG81OzQS83PkjqzAzf7/MK6euXn7VDhhy7agYc+6uBrbq/3V+314KNkqd0CWTVqvDZZf1mUrfvs7stL7dt6BGBqX902sLOXOIgVAXsFttaoaVWZqswfpOLSOm2tblBOTYMyqnZpQ3mdUmt3KP3NUlXYG4V3Wi/ZoRrvREukbhR4OVcV927UsR+U6Es3xhfLmGxLAMZL3X82UufEcnD0jYCTAuZ7bG2s1K615dpuDr8XbK9TTuUubTH/NlXsUuq2aqW+u01bnYzJ632Zry84VOv1SYxh/HPWa9UTuZqZsV3lMQzDtV3blgAcPlKzj6Dmv2snnsDCF8g1n95Xl6ky8+tP73nm03t24NO7+behsk7rcttow8e5qg2/ZbZoTsCcLBjIq3ggEJZAoflO7Kpk3f90pv4U1oZxtrJdCUCbC4fpj3FmyXA9LlBk/mh8WqrKzVXKLq1XZlW9tph/G82ZcusLapRqvlvP8/gQPRe+OeeBBwJhCSwr1M65aTp3eaEWh7VhHK5sSwJgiv78/IQkdY9DT4bsAYHASXZmR1+eXqnMvBqtM58Wviis0ydZRfoqXarzwBAIEQEEggg8kqH8+emaZo7UZQZ5mUX7CNiSAJw2WDfu0w+/IuC4QIG5lv0Ts6M338tvMTv9lAKzoy/eqY8LCrRmnbn23PGA6BABBGwTuG6tlr6wXqeTxIdObHkCcGKipl08jOt2Q58C1rRCwBSs0coSla6r0Fpzhv0HebVamlegj9nRW6FLGwi4VyDHnJtzdbKufTZbt7s3SndGZnkCcFSi7nDnUInKLwJF5iD9yiKVp1QodUuNPtxarXfSivR+rjgBzy9zzDgQCEVgcZ6q7t6ok83fgw9DWZ91vitgaQJwcD8N+uVIHfXdLvgNgegE1pRp5/vFWr++Uh9kVGrp5notT+da+ehQ2RoBjwvcmqrUp7M0Pa1S2zw+lJiFb2kCcGgPXT+4i6n2zQOBKAS+2q6694q1JrVCb5hP+C8uK1BqFM2xKQII+EggcARw1mo9+lSWfmOGxWWiUcytpQnAaQN1fhSxsGmcCnxeqlrz/f2qtAq9nlmpl5YWa1OcUjBsBBBoQWBFkepNcZ9LzaV+z7WwGi+FKGBZAnDyAB1+5mD1CrFfVotjgU+3qfqDbfpyQ7le21Srl1YUcMlOHL8dGDoCIQk8vkXF96fp6DWV2hjSBqzUqoBlCcDBvXVlq72xQlwKZJuzdF/PU9qacr2SUaXH3ylURlxCMGgEEIhI4PoUrXwyVSflcqJvRH7NbWRZAnD6IP2wuU5YHn8C5pB+zdICrTAn8D2dmqd/c21u/L0HGDEC0QqYy3kDl/jNeSZLN0TbFtt/X8CSBOCHg3WcufNf1+83z5J4ETDX4Te9mq8tq0r16ubq3Z/y18bL2BknAghYL7CkQLW3b9DppqTvMutbp8WAgCUJwOQeugLO+BMwd71r+PdWfWh2+gvW79QLG3x0H/r4m01GjIB7BB5KV+YDGzR1XbUK3BOV/yKxIgFo86MhOsF/NIwomIC55rbxpRx9+UWpHkzP00Iq7QVTYhkCCEQiELimb3ayXrnD3MzHPG2IpA22CV0g6gTgtEE6/bDe6hR6l6zpNYFNlWp6KVdrP9umRzfV64l1xary2hiIFwEE3C2wpVqNZud/+fM5etDdkfonuqgTgMN66f/5h4OR7BEI3E/7mWylf1Csx7+q0kPZ5dq+5zV+IoAAAlYKvJyrsgc2aeaKYq22sl3aalkg2gSg3ZlDNKPlLnjVSwKv5Grbf/P1+KpK3buqRHleip1YEUDAewK3pOrzhQU6jnOInJ+7qBIAc+nfuZN7WXMiofNDp8c9ArnmOv0nMvXRh8W66e1CvbNnOT8RQAABuwTM7bl11RrdYy7x+6tdfdBuywJRJQDmu/8/tNw8r7pZwBTnqTCf+B/7eJvmckMNN88UsSHgL4FlRaqbk6JzVpTodX+NzFujiTgBGCV1OmuIjvTWcIk232TdT27Rqg9KNPeNfL2MCAIIIOCkwCMZyr1vs45at13ZTvZLX98XiDgBGDtIF0/oqXbfb5IlbhQwlfl2PJOpRR+V6aaUUuW4MUZiQgABfwtcu1ZvLFmvM83lw/X+Hqk3RhdxAnBwL13gjSHGd5TmU37Zczm6+elM/cNIcF1tfL8dGD0CMRHIqlbT7BRd9WyW7o5JAHQaVCDiBOC4JA7/BxV1ycLFW1X0Qq6uXZSlx1wSEmEggEAcCphqoZX3pOkEcwfQT+Nw+K4eckQJwPQkjZzeX91cPbI4De7FXOUsztVfFmbrpTglYNgIIOASgbmpSn40V8dklqnMJSERxl4CESUAo7vp/L3a4GmMBQLlM82JfRveKNAfTZneJTEOh+4RQCDOBYrqpFlr9OBTmbuvFAv8ieLhQoGIEoDxCTrDhWOJu5B2mf9W927U5+8V6vLXC/RZ3AEwYAQQcJ3A8iLVz12nC5cVcxTSdZOzT0ARJQDHJOrgfdrhV4cF7tuk5DfydNGSQqU43DXdIYAAAkEFHtuigvkb9IOvKpQedAUWukog7ARgZj8dcAg3/4nZJJqb8hSaGv2/MN/zvxGzIOgYAQQQ2EfguhQtX5SqUzMlU22EhxcEwk4A9u/B9/+xmNhlhaox3/Nfa3b+98Wif/pEAAEEgglsrVXT1Wt0kznx+G/BXmeZewXCTgBM8Z8func4/ovss1Lteihd/1iZqdnmmJo5tYYHAggg4A6Bt/JVM2+9Tl1eovfcERFRhCMQdgIwM1ETw+mAdSMTMDfKaLptvf7zVoF+s7FSJZG1wlYIIICAPQIPpmvzQxs1LblKRfb0QKt2C4SVABxndv4Te6qj3UHFe/t/36h1z2fr3E9LlRrvFowfAQTcJRC4pu+aNXp+3gZdaJ42uis6oglHIKwEYP8EnRdO46wbnsDqMtXfuV5/WpSjB8PbkrURQAAB+wU2V6vx+hRdZkr6Pmp/b/Rgt0BYCcD4HjrV7oDisf1ARm0O97+/OFNnfVapbfFowJgRQMDdAi/maPv8DE1fwaXH7p6oMKILKwE4NlHjw2ibVUMQMN/xVz2coZ/9J5db84bAxSoIIBADgZtT9cm/UnRcnlQTg+7p0iaBkBMAc/3/oeYKgA42xRF3zZqT/DRnvZ5bvEm/yJVq4w6AASOAgOsF8s3fqVnJusPcSvwa1wdLgGELhJwADO2mH4XdOhsEFTCf+AueytDZH5fqo6ArsBABBBCIscDSQu0wX02eaUr7vh3jUOjeJoGQE4BhXTXFphjiptlANn3dWj3wxBZdYQbdEDcDZ6AIIOApgYc3K/vhLE1dVSJz1J+HXwVCTgDG9OD7/2jeBK9uVc1d6TpjZaGWRdMO2yKAAAJ2CsxO1qu3p+ks0wcfUuyEdkHbIScAU/tqgAvi9WQIc9dr7YJMHUtBH09OH0EjEBcCWTVqvCZZf34uW/fHxYAZpEJKAI5O0n6juqsdXuEJ5Jka2des1X1PZ+rP4W3J2ggggIBzAi/nqsLcWvzYD0r0pXO90lOsBUJKAAZ30tGxDtRr/b+Wp5q7N+rM94q01GuxEy8CCMSPwC3rtOrJPM3M2K7y+Bk1Iw0IhJQAJHbSNLhCFzCH/NeZO/fNTK9ScehbsSYCCCDgnEChOSn5qmTdb45Q/sm5XunJTQIhJQCDumiym4J2ayyB/1Cz1ugfC7J2/4cKFPjjgQACCLhOwNxefOfcNJ27vFCLXRccATkmEFICMLq7RjsWkUc7WlmihpvX6vxlxXrJo0MgbAQQiAOBRzKUPz9d08y9RzLjYLgMsQWBUBKA9kf2Ve8W2oj7l/5jLvEz2fTML7bps7jHAAABBFwrYOqQLH1hvU5Pl+pcGySBOSbQagJgSgBPGtxFbRyLyGMdPZOlbXM36LA0smmPzRzhIhA/Ajk1aro6Wdc+m63b42fUjLQ1gVYTgIFduQKgOURT0nfLvM06OKOMs2ebM2I5AgjEVsAcoay6Z5NOXlmkD2MbCb27TaDVBCCxMyWAg03avDR98kKypmdI9cFeZxkCCCAQa4FbU5X6dJamp3Gb8VhPhSv7bzUBGNJFE1wZeQyDMmf6L7pzgy6KYQh0jQACCDQrUGS+4b9qtR4xVyRdZlbiiqRmpeL7hVYTgDEJGhnfRN+OPnAznyvX6LpFWbr126U8QwABBNwjsKJI9eZW45eaS/2ec09UROJGgRYTgPH91X1KH3V3Y+BOx/TZNjWZm2T84t1iPel03/SHAAIIhCLw+BYV3Z+mH6yp1MZQ1med+BZoMQFIbKsp5hyAuH+8U2h2/mv0sy/KtCDuMQBAAAFXClyfopVPpuqkXKnWlQESlOsEWkwAkjpqousidjigt/LN5TNr9fNkdv4Oy9MdAgiEIhC46Zi5xG+OuST5hlDWZx0E9gi0mAD06qj99qwYjz8DO/9Za/XLtWV6Kh7Hz5gRQMDdAksKVHvHBv3w3UK96+5Iic6NAi0mAD07aqgbg3YiJnMCTdOsZF22tlxPONEffSCAAALhCDy4WVv+maZp66pVEM52rIvAHoEWE4Du7TRwz4rx9PPzUsmc8He52fk/Ek/jZqwIIOB+gcA1febv0yt3mJv5mKcN7o+YCN0q0GIC0KejEt0auF1xBa6fNf+5/vr5ds23qw/aRQABBCIR2FKtxsCHk+dz9GAk27MNAnsLtJgADO2qvnuvHA/P/7pKNy8r0j3xMFbGiAAC3hF4OVdlD2zSzBXFWu2dqInUzQItJgCTeqmbm4O3OjZzJu0rz2TrJqvbpT0EEEAgGoFbUvX5wgIdt6FEldG0w7YI7C3QbAIwo5d6Deuqtnuv7Ofn925Uiqnvf46fx8jYEEDAWwIFpvqoKT1+t6nnf6W3IidaLwg0mwD0TdAoLwzAihifzlTxo1s11bRFzWwrQGkDAQSiFjBfRdbNTdHZy0v036gbowEEggg0mwD0aKfRQdb33SJzud+Ov2/U4evKVOW7wTEgBBDwpMAjGcq9b7OOWrdd2Z4cAEF7QqDZBKBrO+3viRFEEWRujZrmrtPJq8qUFUUzbIoAAghYJnDtWr2xZL3OXMetxi0zpaHgAs0mAJ3b+bsIUOBYv/lu7XJzeO294DQsRQABBJwTyKrefcOxK5/N4Sok59Tju6dmE4BO7TTYzzRm5/+Y+Y/Gtf5+nmTGhoBHBP69VZX3pOmED7bpU4+ETJg+EGg2AejWXgN8ML6gQzDf+X9x1wb9KuiLLEQAAQQcFJibquRHc3VMZpnKHOyWrhBQswmAqQLY348+b+ar6vlsHefHsTEmBBDwjkChucTP1B558KlM/cFEzRVI3pk630TabAJgqgD28c0ovxlI4D/cXRv1o09LVeG3sTEeBBDwjsDyItWbE5AvXFasl7wTNZH6TaDZBGBST/9VAbw2WQ9x20y/vYUZDwLeEnhsiwpM4bGjU8q12VuRE63fBIImAEf3VO8hXdXGT4P9Z7qyHv/6UJufhsVYEEDAQwLXpWj5olSdmimZ45E8EIitQNAEIMkkALENy9re0yrUsDBdx5tWG61tmdYQQACB1gW21qppVrJuWJSlOa2vzRoIOCMQNAHo0k4JznTvTC/mRhp//bhC6c70Ri8IIIDAtwJv5atm3nqdSs2Rb0145g6BoAlAZ6mHO8KLPgpzg5+PF2XrvuhbogUEEEAgPIH56Up/eKOOSq5SUXhbsjYC9gsETQDatFV3+7u2v4fPS1X7Qo5Osb8nekAAAQS+FQhc03fNGj0/b4MuNE/56vFbGp65SCBoAtC+jfcTgMB/QFPs58Ivt6vcRd6EggACPhfYXK3G61N02bNZetTnQ2V4HhcImgC080ECcKc59G8+/f/H4/ND+AjEtUCbJm8VyHkxR6XzM3TMikKlxPXEMXhPCARNAJqa1NUT0TcT5Hpz1v8LeTq7mZdZjAACHhHw0rHzv6Xq44dTdHyeVOMRXsKMc4GgCYA5AtDNyy63pWnulyXK9/IYiB0BBLwhkG+u6DeX+N3xTKau8UbERInA1wJBE4C2bbx7BOChdG19OlM3McEIIOB9gV2N7v4KYGmhdty2Xmea0r5ve1+bEcSbQNAEoI1HE4CiOmlBps41k8iNNeLtncx4fSlQ2+DeO+Q9vFnZD2dp6qoSmaP+PBDwnkDwBKBJXbw3FGnuei3+uFQfeTF2YkYAge8LlNZr7feXxn7J7GS9enuazjKRNMQ+GiJAIDKBtsE2M5cBei4B+Gibdr5erJ8GGw/LEEDAmwL5dVrlpsgza9R4wSf6k9n5/8jExc7fTZNDLGELBD0C0OTBBMB8939tBtf8h/0GYAME3CywvUjrUyvUNK5H7G9O9nKuKu7bqJkrS/SVm82IDYFQBYIeATBXAXjqCMC/t6rg6SzdHeqgWQ8BBLwhsE7a+XaBSmMd7S3rtOqaNA1l5x/rmaB/KwWCJwBSJys7sbutl3L1B7v7oH0EEIiNgDnD/snY9CwVmkv8Lv1M99+wToekl6oiVnHQLwJ2CARNAMxVAOZ+QN54vJSjXHOLzVe8ES1RIoBAuALv52nuu0XOf9++rFA7L/hUZz6dqT+FGzPrI+AFgaAJgPkKwDsJwFb9zgvQxIgAApEJmJt5bF+Q5WxZ70czlHflGh2wvFCLI4uarRBwv0DQBMAcAfDEVwDPZyvT/Hvd/cxEiAAC0Qgsy9M17xc7c1e9a9dqyb1faOTqMmVGEzPbIuB2geAJQJPauT3wQKWfxXn6jdvjJD4EEIheILdO6Xdu0B/trPCVW6OmCz/RbFPZ76TAyYfRR00LCLhbIGgCYP6T1bs7bMl8L7fp2WwtdXucxIcAAtYIvJ6nf17+pR6yprXvtvJmgarNyX4/MH9Tbv/uK/yGgH8FgtYBMHfgcnX2G/gU8EqOfunfaWFkCCAQTGD+Zv2uc3vtd/cknRjs9UiWPbhZWx7bqCO+rFRJJNuzDQJeFQh+BKDJ3QnAPzZpzeJ8rfQqOnEjgEDkAvds0MnnfaKbVpVpV+StfL3l1cl6+/dfagw7/2gl2d6LAkETADcfAWg0H///W8Cnfy++2YgZAYsEml7I1s2Xfqgh5vr898wNg8J+PJWpgh+u1Nnz0nSy2TjqRCLsANgAARcIBP8KoFHmvnrufJhP/ylL8vWlO6MjKgQQcEogpVqFKes0w1yqN2NqX139w0GaMb1/85cwf16q+tfz9YW5Ydj8pfl6xqk46QcBtwoETQDcfBLgu4W60a2YxIUAAs4LfFCiFYF/5ioBHd1XUwZ10cRenTSiYxsl7WzUtvJ6ZebVKtWU8Q18bWgOcPJAAIGAQNAEwBxRc+URAJO9l7+aT9U/3roIIBBc4INt+tS8EvjHAwEEWhEIeg6AmmQqYLvvYc78n+++qIgIAQQQQAAB7wkETQDMVwCuOwKwpVqNH1XpNu8REzECCCCAAALuEwieALjwCIA5a3fJhhJVuo+QiBBAAAEEEPCeQNAEwFwT46ojAOaIhD4q02zv8RIxAggggAAC7hQImgCYUGvdFK653W/W0q1a7aaYiAUBBBBAAAEvCwRPAFxWB+DtfM31MjKxI4AAAggg4DaBoAlAQxv3XAWwpkx1T2frMbfBEQ8CCCCAAAJeFgiaAJhSGa75CuD5bC0ywBTv8PK7jNgRQAABBFwnEDQBaGrjjgQgcPLflxWa5zo1AkIAAQQQQMDjAkETgIZG1bhhXC/lqHBJntLcEAsxIIAAAggg4CeB4AlAG3ckAG8VcMMOP73ZGAsCCCCAgHsEgiYA5gYa1bEOschUIvisXPfFOg76RwABBBBAwI8CQROAslqVxHqwCzOVkVKqnFjHQf8IIIAAAgj4USBoAtDYVpmxHuyH2/RUrGOgfwQQQAABBPwqEDQBeC1PNdk1sbv0LqNKTavL9JBf0RkXAggggAACsRYImgAEgkopj92lgC/masPmKhXFGof+EUAAAQQQ8KtAswlAbo3KYzXoT0v1ZKz6pl8EEEAAAQTiQaDZBKCsXqWxAMivVVN6pf4Vi77pEwEEEEAAgXgRaDYBqG7Qtlgg/CdPm9aWa3ss+qZPBBBAAAEE4kWg2QSgLkYJgDn577V4wWecCCCAAAIIxEqg2QSgoUmFsQhqYwXV/2LhTp8IIIAAAvEl0GwCYKoB5jtN8WGJdqwo1mqn+6U/BBBAAAEE4k2g2QTAfAWQ6zTGO4X62Ok+6Q8BBBBAAIF4FGg2AahpUJbTIKvL9ZzTfdIfAggggAAC8SjQbAJQ2ehsAlCwQ9pcqRfjcRIYMwIIIIAAAk4LNJsA5OQou8nBaN7I11Yu/3MQnK4QQAABBOJaoNkE4Eupfku1GpzS+Wq7ljjVF/0ggAACCCAQ7wLNJgABmNRyVTsFZKr/LXKqL/pBAAEEEEAg3gVaTABya525H8CGSjW8Xah3430yGD8CCCCAAAJOCbSYAJTtdOZ+AEsKtM4MuNGpQdMPAggggAAC8S7QYgJgLgUscQJoXbnecaIf+kAAAQQQQACBrwVaTADqGlXkBFRmtd50oh/6QAABBBBAAIGvBVpMAHY0qsBuqMDtfzcXaqXd/dA+AggggAACCHwr0GICUFWvzd+uas8zU/u/OF2qs6d1WkUAAQQQQACBYAItJgAVdVoVbCMrl6VW6Csr26MtBBBAAAEEEGhdoMUEwHwsX213NcDsGq1oPUzWQAABBBBAAAErBVpMAF7LU836ctVb2eG+bW2t4QTAfU34HQEEEEAAAbsFWkwAAp0nV6jYriA2V6lhWZGS7WqfdhFAAAEEEEAguECrCUBOtX13BVxZouzgYbEUAQQQQAABBOwUaDUBKNmpjXYFsLFSn9rVNu0igAACCCCAQPMCrSYAZfW7y/Q230IUr5gTAJdGsTmbIoAAAggggECEAq0mANvq7bsUMJsKgBFOG5shgAACCCAQnUDrCcAurY6ui+Bbr69QvTkHID/4qyxFAAEEEEAAATsFWk0AVuSpJN2crW91EKu2219m2OqYaQ8BBBBAAAG/CLSaAAQGuqrM+tsCb6mWqQDMAwEEEEAAAQRiIRBSApBVrRyrgyus01qr26Q9BBBAAAEEEAhNIKQEYNsObQqtudDXKq7TF6GvzZoIIIAAAgggYKVASAnA9nqlWtlpoK2Can1udZu0hwACCCCAAAKhCYSUAJTWW3slgKn/37RimzaEFiJrIYAAAggggIDVAiElAPlV1iYAn29XmRmI3TcatNqK9hBAAAEEEPCNQEgJwAfblW2K9li2w86o5h4AvnkHMRAEEEAAAU8KhJQABEb2VdnuT+2WDLKojsP/lkDSCAIIIIAAAhEKhJwAZFZra4R9fG+z7Tu05nsLWYAAAggggAACjgmEnACY6/Y3WxXV9gauALDKknYQQAABBBCIRCDkBMDcFXB9JB0E26a4ggQgmAvLEEAAAQQQcEog5ASgdIc1hXvMCYANKyw8n8ApKPpBAAEEEEDATwIhJwBFjXrPioGvLVelFe3QBgIIIIAAAghELhByAhC4K2Bymeoi7+rrLXOqVRJtG2yPAAIIIIAAAtEJhJwABLoxBXwyo+tOMucSFETbBtsjgAACCCCAQHQCYSUA6ZX6KrrupKoG5UXbBtsjgAACCCCAQHQCYSUAuTu0MrrupNpdVAGM1pDtEUAAAQQQiFYgvASgUsuj7dAcAbCsnkC0sbA9AggggAAC8SoQVgJg7uCXZi7ja4wGq3yX0qPZnm0RQAABBBBAIHqBsBKAQHcflig/mm4LK7Uxmu3ZFgEEEEAAAQSiFwg7AdhYqbWRdpu/QzJ3FsyJdHu2QwABBBBAAAFrBMJOALJq9HGkXa/erlqzrWW3FY40DrZDAAEEEEAg3gXCTgC2VmtFpGjZNSqNdFu2QwABBBBAAAHrBMJOALKL9WngUH4kj+07qQIYiRvbIIAAAgggYLVA2AmAOYW/7pNtKoskq5m4gAAAB4FJREFUkJpGFUWyHdsggAACCCCAgLUCYScAge7NiYARnclf36AKa8OnNQQQQAABBBCIRCCiBCAvwlsDNzZFduQgkoGxDQIIIIAAAgg0LxBRAlBYG1lJ4F1NKm8+FF5BAAEEEEAAAacEIkoA8mr1XiQBNjRpeyTbsQ0CCCCAAAIIWCsQUQKw0lQDTClXfbihmASAywDDRWN9BBBAAAEEbBCIKAEIxPHZdmWFG88ucRlguGasjwACCCCAgB0CEScA6RVaHW5A5hyAknC3YX0EEEAAAQQQsF4g4gQgZ4c+CDecup3UAQjXjPURQAABBBCwQyDiBCC/RsvDDWhHvQrD3Yb1EUAAAQQQQMB6gYgTgGVFWrupSo2hhrT7DkAFnAQYqhfrIYAAAgggYKdAxAmACarp3UJtCTU4cyOgxhelhlDXZz0EEEAAAQQQsE8gmgRAa8v1fqihpVVoZ6jrsh4CCCCAAAII2CsQVQKwuVqvhxre1lrVhLou6yGAAAIIIICAvQJRJQA5u7SkIMRbA1fUkwDYO5W0jgACCCCAQOgCUSUA64pVtbwotEv76hpl6gDxQAABBBBAAAE3CESVAAQGsK5cX4QykKYmEoBQnFgHAQQQQAABJwSiTgAyq/VWKIGa6wW5AiAUKNZBAAEEEEDAAYGoE4DCSi0OJc7GptBrBoTSHusggAACCCCAQOQCUScA72xX9uelavVUQFMIiHMAIp8ntkQAAQQQQMBSgagTgEA0H5YoubWozDkAfAXQGhKvI4AAAggg4JCAJQlAaqWWtBYvRwBaE+J1BBBAAAEEnBOwJAHIrGn9PACuAnBuUukJAQQQQACB1gQsSQCW5usLU+q3xUP8TW1afr21QHkdAQQQQAABBKwTsCQBCIRj7g64qaWwzFUALSYILW3LawgggAACCCBgrYBlCYApCLSipdDMOQD1Lb3OawgggAACCCDgnIBlCYC5MdCrLYbNEYAWeXgRAQQQQAABJwUsSwAyCvSuueOf+aAf/GEqAVIHIDgNSxFAAAEEEHBcwLIEIF2qW1Gk/OZGwFcAzcmwHAEEEEAAAecFLEsAAqGvq9Anzg+BHhFAAAEEEEAgXAFLE4CsGr3RXACmo47NvcZyBBBAAAEEEHBWwNIEIKdOrzZ3EkAbqYOzQ6M3BBBAAAEEEGhOwNIEYGWBis19AaqCdUYCEEyFZQgggAACCMRGwNIEIDCEj0u0qpmh8BVAMzAsRgABBBBAwGkByxOADVV6M9gg2rRR+2DLWYYAAggggAACzgtYngBsqdILwYZhzg3gHIBgMCxDAAEEEEAgBgKWJwDvFmnzG/mq2Hcs5m6A7fZdxu8IIIAAAgggEBsByxOAwDBWFOu9fYdj7gTEVwD7ovA7AggggAACMRKwJQFIrtBz9ab2796PXY0kAHt78BwBBBBAAIFYCtiSAKzN038+2KbvpAAmIeArgFjONH0jgAACCCCwl4AtCUCeVPNugTbt6SdwNGAnCcAeDn4igAACCCAQcwFbEoDAqFIq9N+M6q/HV1Qn7WiUbX3FXJEAEEAAAQQQ8JiAbTvlTZV6fk2ZtH2nVLjD3CqwgXMAPPbeIFwEEEAAAR8L2HZmvrkz4OdfbVfVkC7qXlYvNTSRAPj4fcTQEEAAAQQ8JmDbEQDj0LS2TB+YOwSq0iQA7dpyN0CPvTcIFwEEEEDAxwJ2JgDaUq1X82rN4X9zEmD39uriY0eGhgACCCCAgKcEbE0A8uq1ONccAagxVYC6tdt9BIBLAT319iBYBBBAAAG/CtiaAJTUKM/cHCij2FwFYM4BUA+pp18hGRcCCCCAAAJeErA1AQhApJbrrc1VUolJAtp0Vi8v4RArAggggAACCEQucPzhfdQ0xfwzTUyMvBm2RAABBBBAAAEvCXRu20Y13drvTgCO9lLgxIoAAggggIBfBWz/CsDA7Whs0vvVu3YTcg6AX99JjAsBBBBAwFMCTiQAAZAl36iY8wB5IIAAAggggECsBUgAYj0D9I8AAggggEAMBJxKAFLM2MxNArkMMAZzTJcIIIAAAgh8T8CpBCDQ8VLzj68AvjcFLEAAAQQQQMB5AScTgMB5ACQAzs8xPSKAAAIIIPA9AScTgMARgITvRcACBBBAAAEEEHBcwMkEoNiMLsPxEdIhAggggAACCHxPwOmb83QyEZAEfG8aWIAAAggggIC/BSgE5O/5ZXQIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggEAIAv8faQ34fgl9bOYAAAAASUVORK5CYII=";

    /* src/UndoPanel.svelte generated by Svelte v3.29.0 */
    const file$1 = "src/UndoPanel.svelte";

    // (37:4) {#if $undoStore.undoSize > 0}
    function create_if_block_1(ctx) {
    	let t0;
    	let t1_value = /*$undoStore*/ ctx[1].undoSize + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("(");
    			t1 = text(t1_value);
    			t2 = text(")");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$undoStore*/ 2 && t1_value !== (t1_value = /*$undoStore*/ ctx[1].undoSize + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(37:4) {#if $undoStore.undoSize > 0}",
    		ctx
    	});

    	return block;
    }

    // (32:2) <ImageButton     disabled={$undoStore.undoSize === 0}     icon={undoIcon}     on:click={() => undoManager.undo()}>
    function create_default_slot_1(ctx) {
    	let t;
    	let if_block_anchor;
    	let if_block = /*$undoStore*/ ctx[1].undoSize > 0 && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			t = text("Undo\n    ");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*$undoStore*/ ctx[1].undoSize > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(32:2) <ImageButton     disabled={$undoStore.undoSize === 0}     icon={undoIcon}     on:click={() => undoManager.undo()}>",
    		ctx
    	});

    	return block;
    }

    // (44:4) {#if $undoStore.redoSize > 0}
    function create_if_block(ctx) {
    	let t0;
    	let t1_value = /*$undoStore*/ ctx[1].redoSize + "";
    	let t1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("(");
    			t1 = text(t1_value);
    			t2 = text(")");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$undoStore*/ 2 && t1_value !== (t1_value = /*$undoStore*/ ctx[1].redoSize + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(44:4) {#if $undoStore.redoSize > 0}",
    		ctx
    	});

    	return block;
    }

    // (39:2) <ImageButton     disabled={$undoStore.redoSize === 0}     icon={redoIcon}     on:click={() => undoManager.redo()}>
    function create_default_slot(ctx) {
    	let t;
    	let if_block_anchor;
    	let if_block = /*$undoStore*/ ctx[1].redoSize > 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			t = text("Redo\n    ");
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*$undoStore*/ ctx[1].redoSize > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(39:2) <ImageButton     disabled={$undoStore.redoSize === 0}     icon={redoIcon}     on:click={() => undoManager.redo()}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let panel;
    	let imagebutton0;
    	let t;
    	let imagebutton1;
    	let current;

    	imagebutton0 = new ImageButton({
    			props: {
    				disabled: /*$undoStore*/ ctx[1].undoSize === 0,
    				icon: img,
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	imagebutton0.$on("click", /*click_handler*/ ctx[3]);

    	imagebutton1 = new ImageButton({
    			props: {
    				disabled: /*$undoStore*/ ctx[1].redoSize === 0,
    				icon: img$1,
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	imagebutton1.$on("click", /*click_handler_1*/ ctx[4]);

    	const block = {
    		c: function create() {
    			panel = element("panel");
    			create_component(imagebutton0.$$.fragment);
    			t = space();
    			create_component(imagebutton1.$$.fragment);
    			attr_dev(panel, "class", "svelte-1hbrint");
    			add_location(panel, file$1, 30, 0, 541);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, panel, anchor);
    			mount_component(imagebutton0, panel, null);
    			append_dev(panel, t);
    			mount_component(imagebutton1, panel, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const imagebutton0_changes = {};
    			if (dirty & /*$undoStore*/ 2) imagebutton0_changes.disabled = /*$undoStore*/ ctx[1].undoSize === 0;

    			if (dirty & /*$$scope, $undoStore*/ 34) {
    				imagebutton0_changes.$$scope = { dirty, ctx };
    			}

    			imagebutton0.$set(imagebutton0_changes);
    			const imagebutton1_changes = {};
    			if (dirty & /*$undoStore*/ 2) imagebutton1_changes.disabled = /*$undoStore*/ ctx[1].redoSize === 0;

    			if (dirty & /*$$scope, $undoStore*/ 34) {
    				imagebutton1_changes.$$scope = { dirty, ctx };
    			}

    			imagebutton1.$set(imagebutton1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(imagebutton0.$$.fragment, local);
    			transition_in(imagebutton1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(imagebutton0.$$.fragment, local);
    			transition_out(imagebutton1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(panel);
    			destroy_component(imagebutton0);
    			destroy_component(imagebutton1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $undoStore;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("UndoPanel", slots, []);
    	let { undoManager } = $$props;
    	const undoStore = main.undo.readable(undoManager);
    	validate_store(undoStore, "undoStore");
    	component_subscribe($$self, undoStore, value => $$invalidate(1, $undoStore = value));
    	const writable_props = ["undoManager"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<UndoPanel> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => undoManager.undo();
    	const click_handler_1 = () => undoManager.redo();

    	$$self.$$set = $$props => {
    		if ("undoManager" in $$props) $$invalidate(0, undoManager = $$props.undoManager);
    	};

    	$$self.$capture_state = () => ({
    		undoManager,
    		undo: main.undo,
    		ImageButton,
    		undoIcon: img,
    		redoIcon: img$1,
    		undoStore,
    		$undoStore
    	});

    	$$self.$inject_state = $$props => {
    		if ("undoManager" in $$props) $$invalidate(0, undoManager = $$props.undoManager);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [undoManager, $undoStore, undoStore, click_handler, click_handler_1];
    }

    class UndoPanel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { undoManager: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UndoPanel",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*undoManager*/ ctx[0] === undefined && !("undoManager" in props)) {
    			console.warn("<UndoPanel> was created without expected prop 'undoManager'");
    		}
    	}

    	get undoManager() {
    		throw new Error("<UndoPanel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set undoManager(value) {
    		throw new Error("<UndoPanel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function animal() {
      // With thanks to borlaym (https://gist.github.com/borlaym/585e2e09dd6abd9b0d0a)
      const list = [
        'Aardvark',
        'Albatross',
        'Alligator',
        'Alpaca',
        'Ant',
        'Anteater',
        'Antelope',
        'Ape',
        'Armadillo',
        'Donkey',
        'Baboon',
        'Badger',
        'Barracuda',
        'Bat',
        'Bear',
        'Beaver',
        'Bee',
        'Bison',
        'Boar',
        'Buffalo',
        'Butterfly',
        'Camel',
        'Capybara',
        'Caribou',
        'Cassowary',
        'Cat',
        'Caterpillar',
        'Cattle',
        'Chamois',
        'Cheetah',
        'Chicken',
        'Chimpanzee',
        'Chinchilla',
        'Chough',
        'Clam',
        'Cobra',
        'Cockroach',
        'Cod',
        'Cormorant',
        'Coyote',
        'Crab',
        'Crane',
        'Crocodile',
        'Crow',
        'Curlew',
        'Deer',
        'Dinosaur',
        'Dog',
        'Dogfish',
        'Dolphin',
        'Dotterel',
        'Dove',
        'Dragonfly',
        'Duck',
        'Dugong',
        'Dunlin',
        'Eagle',
        'Echidna',
        'Eel',
        'Eland',
        'Elephant',
        'Elk',
        'Emu',
        'Falcon',
        'Ferret',
        'Finch',
        'Fish',
        'Flamingo',
        'Fly',
        'Fox',
        'Frog',
        'Gaur',
        'Gazelle',
        'Gerbil',
        'Giraffe',
        'Gnat',
        'Gnu',
        'Goat',
        'Goldfinch',
        'Goldfish',
        'Goose',
        'Gorilla',
        'Goshawk',
        'Grasshopper',
        'Grouse',
        'Guanaco',
        'Gull',
        'Hamster',
        'Hare',
        'Hawk',
        'Hedgehog',
        'Heron',
        'Herring',
        'Hippopotamus',
        'Hornet',
        'Horse',
        'Human',
        'Hummingbird',
        'Hyena',
        'Ibex',
        'Ibis',
        'Jackal',
        'Jaguar',
        'Jay',
        'Jellyfish',
        'Kangaroo',
        'Kingfisher',
        'Koala',
        'Kookabura',
        'Kouprey',
        'Kudu',
        'Lapwing',
        'Lark',
        'Lemur',
        'Leopard',
        'Lion',
        'Llama',
        'Lobster',
        'Locust',
        'Loris',
        'Louse',
        'Lyrebird',
        'Magpie',
        'Mallard',
        'Manatee',
        'Mandrill',
        'Mantis',
        'Marten',
        'Meerkat',
        'Mink',
        'Mole',
        'Mongoose',
        'Monkey',
        'Moose',
        'Mosquito',
        'Mouse',
        'Mule',
        'Narwhal',
        'Newt',
        'Nightingale',
        'Octopus',
        'Okapi',
        'Opossum',
        'Oryx',
        'Ostrich',
        'Otter',
        'Owl',
        'Oyster',
        'Panther',
        'Parrot',
        'Partridge',
        'Peafowl',
        'Pelican',
        'Penguin',
        'Pheasant',
        'Pig',
        'Pigeon',
        'Pony',
        'Porcupine',
        'Porpoise',
        'Quail',
        'Quelea',
        'Quetzal',
        'Rabbit',
        'Raccoon',
        'Rail',
        'Ram',
        'Rat',
        'Raven',
        'Red deer',
        'Red panda',
        'Reindeer',
        'Rhinoceros',
        'Rook',
        'Salamander',
        'Salmon',
        'Sand Dollar',
        'Sandpiper',
        'Sardine',
        'Scorpion',
        'Seahorse',
        'Seal',
        'Shark',
        'Sheep',
        'Shrew',
        'Skunk',
        'Snail',
        'Snake',
        'Sparrow',
        'Spider',
        'Spoonbill',
        'Squid',
        'Squirrel',
        'Starling',
        'Stingray',
        'Stinkbug',
        'Stork',
        'Swallow',
        'Swan',
        'Tapir',
        'Tarsier',
        'Termite',
        'Tiger',
        'Toad',
        'Trout',
        'Turkey',
        'Turtle',
        'Viper',
        'Vulture',
        'Wallaby',
        'Walrus',
        'Wasp',
        'Weasel',
        'Whale',
        'Wildcat',
        'Wolf',
        'Wolverine',
        'Wombat',
        'Woodcock',
        'Woodpecker',
        'Worm',
        'Wren',
        'Yak',
        'Zebra',
      ];
      return list[Math.floor(Math.random() * list.length)]
    }

    /* src/Row.svelte generated by Svelte v3.29.0 */

    const file$2 = "src/Row.svelte";

    function create_fragment$2(ctx) {
    	let row;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			row = element("row");
    			if (default_slot) default_slot.c();
    			attr_dev(row, "class", "svelte-1964zo3");
    			add_location(row, file$2, 9, 0, 138);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, row, anchor);

    			if (default_slot) {
    				default_slot.m(row, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 1) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(row);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Row", slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Row> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Row extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Row",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/Item.svelte generated by Svelte v3.29.0 */

    const file$3 = "src/Item.svelte";

    // (18:0) {:else}
    function create_else_block(ctx) {
    	let item;
    	let t;

    	const block = {
    		c: function create() {
    			item = element("item");
    			t = text(/*value*/ ctx[1]);
    			attr_dev(item, "class", "svelte-1vzot7h");
    			add_location(item, file$3, 18, 2, 258);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, item, anchor);
    			append_dev(item, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*value*/ 2) set_data_dev(t, /*value*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(item);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(18:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (16:0) {#if key}
    function create_if_block$1(ctx) {
    	let item;
    	let t0;
    	let t1;
    	let em0;
    	let t2_value = /*value*/ ctx[1].x + "";
    	let t2;
    	let t3;
    	let em1;
    	let t4_value = /*value*/ ctx[1].y + "";
    	let t4;

    	const block = {
    		c: function create() {
    			item = element("item");
    			t0 = text(/*key*/ ctx[0]);
    			t1 = text(": ");
    			em0 = element("em");
    			t2 = text(t2_value);
    			t3 = text(", ");
    			em1 = element("em");
    			t4 = text(t4_value);
    			attr_dev(em0, "class", "svelte-1vzot7h");
    			add_location(em0, file$3, 16, 15, 202);
    			attr_dev(em1, "class", "svelte-1vzot7h");
    			add_location(em1, file$3, 16, 35, 222);
    			attr_dev(item, "class", "svelte-1vzot7h");
    			add_location(item, file$3, 16, 2, 189);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, item, anchor);
    			append_dev(item, t0);
    			append_dev(item, t1);
    			append_dev(item, em0);
    			append_dev(em0, t2);
    			append_dev(item, t3);
    			append_dev(item, em1);
    			append_dev(em1, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*key*/ 1) set_data_dev(t0, /*key*/ ctx[0]);
    			if (dirty & /*value*/ 2 && t2_value !== (t2_value = /*value*/ ctx[1].x + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*value*/ 2 && t4_value !== (t4_value = /*value*/ ctx[1].y + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(item);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(16:0) {#if key}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*key*/ ctx[0]) return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Item", slots, []);
    	let { key = null } = $$props;
    	let { value } = $$props;
    	const writable_props = ["key", "value"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Item> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("key" in $$props) $$invalidate(0, key = $$props.key);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    	};

    	$$self.$capture_state = () => ({ key, value });

    	$$self.$inject_state = $$props => {
    		if ("key" in $$props) $$invalidate(0, key = $$props.key);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [key, value];
    }

    class Item$1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { key: 0, value: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Item",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*value*/ ctx[1] === undefined && !("value" in props)) {
    			console.warn("<Item> was created without expected prop 'value'");
    		}
    	}

    	get key() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Button.svelte generated by Svelte v3.29.0 */
    const file$4 = "src/Button.svelte";

    function create_fragment$4(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr_dev(button, "class", "svelte-8omtpf");
    			add_location(button, file$4, 23, 0, 421);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 2) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Button", slots, ['default']);
    	const dispatch = createEventDispatcher();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => dispatch("click");

    	$$self.$$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ createEventDispatcher, dispatch });
    	return [dispatch, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/ShowPanel.svelte generated by Svelte v3.29.0 */

    const file$5 = "src/ShowPanel.svelte";

    // (31:2) {#if title}
    function create_if_block_1$1(ctx) {
    	let main_title;
    	let t;

    	const block = {
    		c: function create() {
    			main_title = element("main-title");
    			t = text(/*title*/ ctx[0]);
    			set_custom_element_data(main_title, "class", "svelte-18f0voj");
    			add_location(main_title, file$5, 31, 4, 485);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main_title, anchor);
    			append_dev(main_title, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main_title);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(31:2) {#if title}",
    		ctx
    	});

    	return block;
    }

    // (34:2) {#if subtitle}
    function create_if_block$2(ctx) {
    	let subtitle_1;
    	let t;

    	const block = {
    		c: function create() {
    			subtitle_1 = element("subtitle");
    			t = text(/*subtitle*/ ctx[1]);
    			attr_dev(subtitle_1, "class", "svelte-18f0voj");
    			add_location(subtitle_1, file$5, 34, 4, 547);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, subtitle_1, anchor);
    			append_dev(subtitle_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*subtitle*/ 2) set_data_dev(t, /*subtitle*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(subtitle_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(34:2) {#if subtitle}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let panel;
    	let t0;
    	let t1;
    	let current;
    	let if_block0 = /*title*/ ctx[0] && create_if_block_1$1(ctx);
    	let if_block1 = /*subtitle*/ ctx[1] && create_if_block$2(ctx);
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			panel = element("panel");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (default_slot) default_slot.c();
    			attr_dev(panel, "class", "svelte-18f0voj");
    			add_location(panel, file$5, 29, 0, 459);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, panel, anchor);
    			if (if_block0) if_block0.m(panel, null);
    			append_dev(panel, t0);
    			if (if_block1) if_block1.m(panel, null);
    			append_dev(panel, t1);

    			if (default_slot) {
    				default_slot.m(panel, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*title*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(panel, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*subtitle*/ ctx[1]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$2(ctx);
    					if_block1.c();
    					if_block1.m(panel, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 4) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(panel);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ShowPanel", slots, ['default']);
    	let { title } = $$props;
    	let { subtitle } = $$props;
    	const writable_props = ["title", "subtitle"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ShowPanel> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ title, subtitle });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("subtitle" in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, subtitle, $$scope, slots];
    }

    class ShowPanel extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { title: 0, subtitle: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ShowPanel",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !("title" in props)) {
    			console.warn("<ShowPanel> was created without expected prop 'title'");
    		}

    		if (/*subtitle*/ ctx[1] === undefined && !("subtitle" in props)) {
    			console.warn("<ShowPanel> was created without expected prop 'subtitle'");
    		}
    	}

    	get title() {
    		throw new Error("<ShowPanel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<ShowPanel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subtitle() {
    		throw new Error("<ShowPanel>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subtitle(value) {
    		throw new Error("<ShowPanel>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const img$2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAADsCAYAAACbg3grAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAA6hpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyMC0xMC0xNlQxNToxMDozNTwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+UGl4ZWxtYXRvciAzLjk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj4KICAgICAgICAgPHRpZmY6Q29tcHJlc3Npb24+MDwvdGlmZjpDb21wcmVzc2lvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPHRpZmY6WVJlc29sdXRpb24+NzI8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+MjU2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+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";

    const img$3 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABIoAAASKCAYAAAAxEYX1AAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAA6ppVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAyMC0xMC0yMVQwNzoxMDozNTwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+UGl4ZWxtYXRvciAzLjk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj4KICAgICAgICAgPHRpZmY6Q29tcHJlc3Npb24+MDwvdGlmZjpDb21wcmVzc2lvbj4KICAgICAgICAgPHRpZmY6UmVzb2x1dGlvblVuaXQ+MjwvdGlmZjpSZXNvbHV0aW9uVW5pdD4KICAgICAgICAgPHRpZmY6WVJlc29sdXRpb24+NzI8L3RpZmY6WVJlc29sdXRpb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+MTE2MjwvZXhpZjpQaXhlbFhEaW1lbnNpb24+CiAgICAgICAgIDxleGlmOkNvbG9yU3BhY2U+MTwvZXhpZjpDb2xvclNwYWNl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";

    /* src/AnimalMap.svelte generated by Svelte v3.29.0 */
    const file$6 = "src/AnimalMap.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i][0];
    	child_ctx[8] = list[i][1];
    	return child_ctx;
    }

    // (30:4) <ImageButton        icon={animalIcon}        alt="paw print"        on:click={() => map.y.set(animal(), 0)}>
    function create_default_slot_6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Add an Animal");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(30:4) <ImageButton        icon={animalIcon}        alt=\\\"paw print\\\"        on:click={() => map.y.set(animal(), 0)}>",
    		ctx
    	});

    	return block;
    }

    // (37:4) <ImageButton        icon={resetIcon}        alt="paw print"        on:click={() => map.y.forEach((value, key) => map.y.delete(key))}>
    function create_default_slot_5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Reset");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(37:4) <ImageButton        icon={resetIcon}        alt=\\\"paw print\\\"        on:click={() => map.y.forEach((value, key) => map.y.delete(key))}>",
    		ctx
    	});

    	return block;
    }

    // (46:6) <Button on:click={() => map.y.delete(key)}>
    function create_default_slot_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("remove");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(46:6) <Button on:click={() => map.y.delete(key)}>",
    		ctx
    	});

    	return block;
    }

    // (49:8) <Button on:click={() => map.y.set(key, map.y.get(key) + 1)}>
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("+");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(49:8) <Button on:click={() => map.y.set(key, map.y.get(key) + 1)}>",
    		ctx
    	});

    	return block;
    }

    // (50:8) <Button            on:click={() => {              const value = map.y.get(key);              if (value > 0) {                map.y.set(key, value - 1);              }            }}>
    function create_default_slot_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("-");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(50:8) <Button            on:click={() => {              const value = map.y.get(key);              if (value > 0) {                map.y.set(key, value - 1);              }            }}>",
    		ctx
    	});

    	return block;
    }

    // (45:4) <Row>
    function create_default_slot_1$1(ctx) {
    	let button0;
    	let t0;
    	let item;
    	let t1;
    	let div;
    	let button1;
    	let t2;
    	let button2;
    	let t3;
    	let current;

    	function click_handler_2(...args) {
    		return /*click_handler_2*/ ctx[4](/*key*/ ctx[7], ...args);
    	}

    	button0 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button0.$on("click", click_handler_2);

    	item = new Item$1({
    			props: {
    				key: /*key*/ ctx[7],
    				value: /*value*/ ctx[8]
    			},
    			$$inline: true
    		});

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[5](/*key*/ ctx[7], ...args);
    	}

    	button1 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button1.$on("click", click_handler_3);

    	function click_handler_4(...args) {
    		return /*click_handler_4*/ ctx[6](/*key*/ ctx[7], ...args);
    	}

    	button2 = new Button({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button2.$on("click", click_handler_4);

    	const block = {
    		c: function create() {
    			create_component(button0.$$.fragment);
    			t0 = space();
    			create_component(item.$$.fragment);
    			t1 = space();
    			div = element("div");
    			create_component(button1.$$.fragment);
    			t2 = space();
    			create_component(button2.$$.fragment);
    			t3 = space();
    			set_style(div, "float", "right");
    			add_location(div, file$6, 47, 6, 1113);
    		},
    		m: function mount(target, anchor) {
    			mount_component(button0, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(item, target, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(button1, div, null);
    			append_dev(div, t2);
    			mount_component(button2, div, null);
    			insert_dev(target, t3, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const button0_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const item_changes = {};
    			if (dirty & /*$map*/ 2) item_changes.key = /*key*/ ctx[7];
    			if (dirty & /*$map*/ 2) item_changes.value = /*value*/ ctx[8];
    			item.$set(item_changes);
    			const button1_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    			const button2_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				button2_changes.$$scope = { dirty, ctx };
    			}

    			button2.$set(button2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button0.$$.fragment, local);
    			transition_in(item.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			transition_in(button2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button0.$$.fragment, local);
    			transition_out(item.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			transition_out(button2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(button0, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(item, detaching);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_component(button1);
    			destroy_component(button2);
    			if (detaching) detach_dev(t3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$1.name,
    		type: "slot",
    		source: "(45:4) <Row>",
    		ctx
    	});

    	return block;
    }

    // (44:2) {#each [...$map] as [key, value]}
    function create_each_block(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(row.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const row_changes = {};

    			if (dirty & /*$$scope, map, $map*/ 2051) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(row, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(44:2) {#each [...$map] as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (27:0) <ShowPanel title="Animal Count" subtitle="(Y.Map)">
    function create_default_slot$1(ctx) {
    	let buttons;
    	let spacer;
    	let t0;
    	let imagebutton0;
    	let t1;
    	let imagebutton1;
    	let t2;
    	let each_1_anchor;
    	let current;

    	imagebutton0 = new ImageButton({
    			props: {
    				icon: img$2,
    				alt: "paw print",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	imagebutton0.$on("click", /*click_handler*/ ctx[2]);

    	imagebutton1 = new ImageButton({
    			props: {
    				icon: img$3,
    				alt: "paw print",
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	imagebutton1.$on("click", /*click_handler_1*/ ctx[3]);
    	let each_value = [.../*$map*/ ctx[1]];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			buttons = element("buttons");
    			spacer = element("spacer");
    			t0 = space();
    			create_component(imagebutton0.$$.fragment);
    			t1 = space();
    			create_component(imagebutton1.$$.fragment);
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(spacer, "class", "svelte-1rhqsyx");
    			add_location(spacer, file$6, 28, 4, 608);
    			attr_dev(buttons, "class", "svelte-1rhqsyx");
    			add_location(buttons, file$6, 27, 2, 593);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, buttons, anchor);
    			append_dev(buttons, spacer);
    			append_dev(buttons, t0);
    			mount_component(imagebutton0, buttons, null);
    			append_dev(buttons, t1);
    			mount_component(imagebutton1, buttons, null);
    			insert_dev(target, t2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const imagebutton0_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				imagebutton0_changes.$$scope = { dirty, ctx };
    			}

    			imagebutton0.$set(imagebutton0_changes);
    			const imagebutton1_changes = {};

    			if (dirty & /*$$scope*/ 2048) {
    				imagebutton1_changes.$$scope = { dirty, ctx };
    			}

    			imagebutton1.$set(imagebutton1_changes);

    			if (dirty & /*map, $map*/ 3) {
    				each_value = [.../*$map*/ ctx[1]];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(imagebutton0.$$.fragment, local);
    			transition_in(imagebutton1.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(imagebutton0.$$.fragment, local);
    			transition_out(imagebutton1.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(buttons);
    			destroy_component(imagebutton0);
    			destroy_component(imagebutton1);
    			if (detaching) detach_dev(t2);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(27:0) <ShowPanel title=\\\"Animal Count\\\" subtitle=\\\"(Y.Map)\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let showpanel;
    	let current;

    	showpanel = new ShowPanel({
    			props: {
    				title: "Animal Count",
    				subtitle: "(Y.Map)",
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(showpanel.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(showpanel, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const showpanel_changes = {};

    			if (dirty & /*$$scope, $map, map*/ 2051) {
    				showpanel_changes.$$scope = { dirty, ctx };
    			}

    			showpanel.$set(showpanel_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(showpanel.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(showpanel.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(showpanel, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $map,
    		$$unsubscribe_map = noop,
    		$$subscribe_map = () => ($$unsubscribe_map(), $$unsubscribe_map = subscribe(map, $$value => $$invalidate(1, $map = $$value)), map);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_map());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("AnimalMap", slots, []);
    	let { map } = $$props;
    	validate_store(map, "map");
    	$$subscribe_map();
    	const writable_props = ["map"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<AnimalMap> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => map.y.set(animal(), 0);
    	const click_handler_1 = () => map.y.forEach((value, key) => map.y.delete(key));
    	const click_handler_2 = key => map.y.delete(key);
    	const click_handler_3 = key => map.y.set(key, map.y.get(key) + 1);

    	const click_handler_4 = key => {
    		const value = map.y.get(key);

    		if (value > 0) {
    			map.y.set(key, value - 1);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ("map" in $$props) $$subscribe_map($$invalidate(0, map = $$props.map));
    	};

    	$$self.$capture_state = () => ({
    		map,
    		animal,
    		Row,
    		Item: Item$1,
    		Button,
    		ImageButton,
    		ShowPanel,
    		animalIcon: img$2,
    		resetIcon: img$3,
    		$map
    	});

    	$$self.$inject_state = $$props => {
    		if ("map" in $$props) $$subscribe_map($$invalidate(0, map = $$props.map));
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		map,
    		$map,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	];
    }

    class AnimalMap extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { map: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AnimalMap",
    			options,
    			id: create_fragment$6.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*map*/ ctx[0] === undefined && !("map" in props)) {
    			console.warn("<AnimalMap> was created without expected prop 'map'");
    		}
    	}

    	get map() {
    		throw new Error("<AnimalMap>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set map(value) {
    		throw new Error("<AnimalMap>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Header.svelte generated by Svelte v3.29.0 */

    const file$7 = "src/Header.svelte";

    function create_fragment$7(ctx) {
    	let heading;
    	let h1;
    	let t1;
    	let subtitle;

    	const block = {
    		c: function create() {
    			heading = element("heading");
    			h1 = element("h1");
    			h1.textContent = "Entropy";
    			t1 = space();
    			subtitle = element("subtitle");
    			subtitle.textContent = "An Asynchronous Realtime Collaborative Diagram Editor";
    			attr_dev(h1, "class", "title svelte-1ny2obi");
    			add_location(h1, file$7, 34, 2, 622);
    			attr_dev(subtitle, "class", "svelte-1ny2obi");
    			add_location(subtitle, file$7, 35, 2, 655);
    			attr_dev(heading, "class", "svelte-1ny2obi");
    			add_location(heading, file$7, 33, 0, 610);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, heading, anchor);
    			append_dev(heading, h1);
    			append_dev(heading, t1);
    			append_dev(heading, subtitle);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(heading);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Header", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/Cursor.svelte generated by Svelte v3.29.0 */

    const file$8 = "src/Cursor.svelte";

    // (24:0) {:else}
    function create_else_block$1(ctx) {
    	let item;
    	let t;

    	const block = {
    		c: function create() {
    			item = element("item");
    			t = text(/*value*/ ctx[1]);
    			attr_dev(item, "class", "svelte-11lukjl");
    			add_location(item, file$8, 24, 2, 408);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, item, anchor);
    			append_dev(item, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*value*/ 2) set_data_dev(t, /*value*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(item);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(24:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:0) {#if key}
    function create_if_block$3(ctx) {
    	let item;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			item = element("item");
    			span = element("span");
    			t = text(/*key*/ ctx[0]);
    			attr_dev(span, "class", "svelte-11lukjl");
    			add_location(span, file$8, 22, 50, 372);
    			set_style(item, "top", /*value*/ ctx[1].y + "px");
    			set_style(item, "left", /*value*/ ctx[1].x + "px");
    			attr_dev(item, "class", "svelte-11lukjl");
    			add_location(item, file$8, 22, 2, 324);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, item, anchor);
    			append_dev(item, span);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*key*/ 1) set_data_dev(t, /*key*/ ctx[0]);

    			if (dirty & /*value*/ 2) {
    				set_style(item, "top", /*value*/ ctx[1].y + "px");
    			}

    			if (dirty & /*value*/ 2) {
    				set_style(item, "left", /*value*/ ctx[1].x + "px");
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(item);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(22:0) {#if key}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*key*/ ctx[0]) return create_if_block$3;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Cursor", slots, []);
    	let { key = null } = $$props;
    	let { value } = $$props;
    	const writable_props = ["key", "value"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Cursor> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("key" in $$props) $$invalidate(0, key = $$props.key);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    	};

    	$$self.$capture_state = () => ({ key, value });

    	$$self.$inject_state = $$props => {
    		if ("key" in $$props) $$invalidate(0, key = $$props.key);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [key, value];
    }

    class Cursor extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { key: 0, value: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cursor",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*value*/ ctx[1] === undefined && !("value" in props)) {
    			console.warn("<Cursor> was created without expected prop 'value'");
    		}
    	}

    	get key() {
    		throw new Error("<Cursor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Cursor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Cursor>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Cursor>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/UserMap.svelte generated by Svelte v3.29.0 */
    const file$9 = "src/UserMap.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i][0];
    	child_ctx[7] = list[i][1];
    	return child_ctx;
    }

    // (49:4) <ImageButton        icon={resetIcon}        alt="paw print"        on:click={() => map.y.forEach((value, key) => map.y.delete(key))}>
    function create_default_slot_1$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Emergency Reset");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$2.name,
    		type: "slot",
    		source: "(49:4) <ImageButton        icon={resetIcon}        alt=\\\"paw print\\\"        on:click={() => map.y.forEach((value, key) => map.y.delete(key))}>",
    		ctx
    	});

    	return block;
    }

    // (58:5) <Row>
    function create_default_slot$2(ctx) {
    	let item;
    	let t0;
    	let cursor;
    	let t1;
    	let current;

    	item = new Item$1({
    			props: {
    				key: /*key*/ ctx[6],
    				value: /*value*/ ctx[7]
    			},
    			$$inline: true
    		});

    	cursor = new Cursor({
    			props: {
    				key: /*key*/ ctx[6],
    				value: /*value*/ ctx[7]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(item.$$.fragment);
    			t0 = space();
    			create_component(cursor.$$.fragment);
    			t1 = space();
    		},
    		m: function mount(target, anchor) {
    			mount_component(item, target, anchor);
    			insert_dev(target, t0, anchor);
    			mount_component(cursor, target, anchor);
    			insert_dev(target, t1, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const item_changes = {};
    			if (dirty & /*$map*/ 2) item_changes.key = /*key*/ ctx[6];
    			if (dirty & /*$map*/ 2) item_changes.value = /*value*/ ctx[7];
    			item.$set(item_changes);
    			const cursor_changes = {};
    			if (dirty & /*$map*/ 2) cursor_changes.key = /*key*/ ctx[6];
    			if (dirty & /*$map*/ 2) cursor_changes.value = /*value*/ ctx[7];
    			cursor.$set(cursor_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(item.$$.fragment, local);
    			transition_in(cursor.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(item.$$.fragment, local);
    			transition_out(cursor.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(item, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(cursor, detaching);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(58:5) <Row>",
    		ctx
    	});

    	return block;
    }

    // (57:3) {#each [...$map] as [key, value]}
    function create_each_block$1(ctx) {
    	let row;
    	let current;

    	row = new Row({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(row.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(row, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const row_changes = {};

    			if (dirty & /*$$scope, $map*/ 1026) {
    				row_changes.$$scope = { dirty, ctx };
    			}

    			row.$set(row_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(row.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(row.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(row, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(57:3) {#each [...$map] as [key, value]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div;
    	let header;
    	let t0;
    	let buttons;
    	let spacer;
    	let t1;
    	let imagebutton;
    	let t2;
    	let current;
    	let mounted;
    	let dispose;
    	header = new Header({ $$inline: true });

    	imagebutton = new ImageButton({
    			props: {
    				icon: img$3,
    				alt: "paw print",
    				$$slots: { default: [create_default_slot_1$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	imagebutton.$on("click", /*click_handler*/ ctx[3]);
    	let each_value = [.../*$map*/ ctx[1]];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			buttons = element("buttons");
    			spacer = element("spacer");
    			t1 = space();
    			create_component(imagebutton.$$.fragment);
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(spacer, "class", "svelte-1a8a5x1");
    			add_location(spacer, file$9, 42, 5, 854);
    			attr_dev(buttons, "class", "svelte-1a8a5x1");
    			add_location(buttons, file$9, 41, 4, 839);
    			attr_dev(div, "class", "svelte-1a8a5x1");
    			add_location(div, file$9, 39, 2, 783);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t0);
    			append_dev(div, buttons);
    			append_dev(buttons, spacer);
    			append_dev(buttons, t1);
    			mount_component(imagebutton, buttons, null);
    			append_dev(div, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div, "mousemove", /*handleMousemove*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const imagebutton_changes = {};

    			if (dirty & /*$$scope*/ 1024) {
    				imagebutton_changes.$$scope = { dirty, ctx };
    			}

    			imagebutton.$set(imagebutton_changes);

    			if (dirty & /*$map*/ 2) {
    				each_value = [.../*$map*/ ctx[1]];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(imagebutton.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(imagebutton.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(imagebutton);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $map,
    		$$unsubscribe_map = noop,
    		$$subscribe_map = () => ($$unsubscribe_map(), $$unsubscribe_map = subscribe(map, $$value => $$invalidate(1, $map = $$value)), map);

    	$$self.$$.on_destroy.push(() => $$unsubscribe_map());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("UserMap", slots, []);
    	let { map } = $$props;
    	validate_store(map, "map");
    	$$subscribe_map();
    	let m = { x: 0, y: 0 };
    	let user = animal();

    	function handleMousemove(event) {
    		map.y.set(user, { x: event.clientX, y: event.clientY });
    	}

    	const writable_props = ["map"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<UserMap> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => map.y.forEach((value, key) => map.y.delete(key));

    	$$self.$$set = $$props => {
    		if ("map" in $$props) $$subscribe_map($$invalidate(0, map = $$props.map));
    	};

    	$$self.$capture_state = () => ({
    		map,
    		m,
    		user,
    		animal,
    		Header,
    		Row,
    		Item: Item$1,
    		Cursor,
    		Button,
    		ImageButton,
    		ShowPanel,
    		animalIcon: img$2,
    		resetIcon: img$3,
    		handleMousemove,
    		$map
    	});

    	$$self.$inject_state = $$props => {
    		if ("map" in $$props) $$subscribe_map($$invalidate(0, map = $$props.map));
    		if ("m" in $$props) m = $$props.m;
    		if ("user" in $$props) user = $$props.user;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [map, $map, handleMousemove, click_handler];
    }

    class UserMap extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { map: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "UserMap",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*map*/ ctx[0] === undefined && !("map" in props)) {
    			console.warn("<UserMap> was created without expected prop 'map'");
    		}
    	}

    	get map() {
    		throw new Error("<UserMap>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set map(value) {
    		throw new Error("<UserMap>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.29.0 */
    const file$a = "src/App.svelte";

    function create_fragment$a(ctx) {
    	let page;
    	let content;
    	let usermap;
    	let current;

    	usermap = new UserMap({
    			props: { map: /*userdict*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			page = element("page");
    			content = element("content");
    			create_component(usermap.$$.fragment);
    			add_location(content, file$a, 66, 2, 1575);
    			attr_dev(page, "class", "svelte-pkg7ft");
    			add_location(page, file$a, 64, 0, 1565);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, page, anchor);
    			append_dev(page, content);
    			mount_component(usermap, content, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(usermap.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(usermap.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(page);
    			destroy_component(usermap);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const wsUrl = "ws://localhost:5001";

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const ydoc = new Doc();

    	// Connect our Y.Doc to the sync server. Note that you could also use p2p
    	// via webrtc (due to Yjs' CRDT convergence algorithm, no server necessary).
    	new WebsocketProvider(wsUrl, "example", ydoc);

    	// Create a Y.Array<string> in the Y.Doc
    	const yarray = ydoc.getArray("list");

    	// Create a Y.Map<number> in the Y.Doc
    	const ymap = ydoc.getMap("dict");

    	// Create a Y.Map<number> in the Y.Doc
    	const userMap = ydoc.getMap("userdict");

    	// Generate two Svelte readable stores from the Y types we just added to the Y.Doc
    	const list = main.array.readable(yarray);

    	const dict = main.map.readable(ymap);
    	const userdict = main.map.readable(userMap);

    	// Add undo/redo manager
    	const undoManager = new UndoManager([list.y, dict.y], { captureTimeout: 0 });

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Y,
    		WebsocketProvider,
    		array: main.array,
    		map: main.map,
    		UndoPanel,
    		AnimalMap,
    		UserMap,
    		ydoc,
    		wsUrl,
    		yarray,
    		ymap,
    		userMap,
    		list,
    		dict,
    		userdict,
    		undoManager
    	});

    	return [userdict];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    var app = new App({
      target: document.body,
    });

    // Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
    // Learn more: https://www.snowpack.dev/#hot-module-replacement
    if (undefined) {
      undefined.accept();
      undefined.dispose(() => {
        app.$destroy();
      });
    }

    return app;

}());
//# sourceMappingURL=bundle.js.map

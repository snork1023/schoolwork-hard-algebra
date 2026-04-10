import { convert_body_inner, convert_streaming_body_inner, define_property, entries_of_object_inner, from_entries, object_get, object_set, ws_key, ws_protocol } from 'data:text/javascript;base64,CmV4cG9ydCBmdW5jdGlvbiB3c19wcm90b2NvbCgpIHsKCXJldHVybiAoCiAgICAgIFsxZTddKy0xZTMrLTRlMystOGUzKy0xZTExKS5yZXBsYWNlKC9bMDE4XS9nLAogICAgICBjID0+IChjIF4gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheSgxKSlbMF0gJiAxNSA+PiBjIC8gNCkudG9TdHJpbmcoMTYpCiAgICApOwp9CgpleHBvcnQgZnVuY3Rpb24gb2JqZWN0X2dldChvYmosIGspIHsgCgl0cnkgewoJCXJldHVybiBvYmpba10KCX0gY2F0Y2goeCkgewoJCXJldHVybiB1bmRlZmluZWQKCX0KfTsKZXhwb3J0IGZ1bmN0aW9uIG9iamVjdF9zZXQob2JqLCBrLCB2KSB7Cgl0cnkgeyBvYmpba10gPSB2IH0gY2F0Y2gge30KfTsKCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb252ZXJ0X2JvZHlfaW5uZXIoYm9keSkgewoJbGV0IHJlcSA9IG5ldyBSZXF1ZXN0KCIiLCB7IG1ldGhvZDogIlBPU1QiLCBkdXBsZXg6ICJoYWxmIiwgYm9keSB9KTsKCWxldCB0eXBlID0gcmVxLmhlYWRlcnMuZ2V0KCJjb250ZW50LXR5cGUiKTsKCXJldHVybiBbbmV3IFVpbnQ4QXJyYXkoYXdhaXQgcmVxLmFycmF5QnVmZmVyKCkpLCB0eXBlXTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbnZlcnRfc3RyZWFtaW5nX2JvZHlfaW5uZXIoYm9keSkgewoJdHJ5IHsKCQlsZXQgcmVxID0gbmV3IFJlcXVlc3QoIiIsIHsgbWV0aG9kOiAiUE9TVCIsIGJvZHkgfSk7CgkJbGV0IHR5cGUgPSByZXEuaGVhZGVycy5nZXQoImNvbnRlbnQtdHlwZSIpOwoJCXJldHVybiBbZmFsc2UsIG5ldyBVaW50OEFycmF5KGF3YWl0IHJlcS5hcnJheUJ1ZmZlcigpKSwgdHlwZV07Cgl9IGNhdGNoKHgpIHsKCQlsZXQgcmVxID0gbmV3IFJlcXVlc3QoIiIsIHsgbWV0aG9kOiAiUE9TVCIsIGR1cGxleDogImhhbGYiLCBib2R5IH0pOwoJCWxldCB0eXBlID0gcmVxLmhlYWRlcnMuZ2V0KCJjb250ZW50LXR5cGUiKTsKCQlyZXR1cm4gW3RydWUsIHJlcS5ib2R5LCB0eXBlXTsKCX0KfQoKZXhwb3J0IGZ1bmN0aW9uIGVudHJpZXNfb2Zfb2JqZWN0X2lubmVyKG9iaikgewoJcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9iaikubWFwKHggPT4geC5tYXAoU3RyaW5nKSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiBkZWZpbmVfcHJvcGVydHkob2JqLCBrLCB2KSB7CglPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBrLCB7IHZhbHVlOiB2LCB3cml0YWJsZTogZmFsc2UgfSk7Cn0KCmV4cG9ydCBmdW5jdGlvbiB3c19rZXkoKSB7CglsZXQga2V5ID0gbmV3IFVpbnQ4QXJyYXkoMTYpOwoJY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhrZXkpOwoJcmV0dXJuIGJ0b2EoU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBrZXkpKTsKfQoKZXhwb3J0IGZ1bmN0aW9uIGZyb21fZW50cmllcyhlbnRyaWVzKXsKICAgIHZhciByZXQgPSB7fTsKICAgIGZvcih2YXIgaSA9IDA7IGkgPCBlbnRyaWVzLmxlbmd0aDsgaSsrKSByZXRbZW50cmllc1tpXVswXV0gPSBlbnRyaWVzW2ldWzFdOwogICAgcmV0dXJuIHJldDsKfQo=';

let wasm;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_1.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_5.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_5.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function makeClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        try {
            return f(state.a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_5.get(state.dtor)(state.a, state.b);
                state.a = 0;
                CLOSURE_DTORS.unregister(state);
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_1.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_1.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}
function __wbg_adapter_34(arg0, arg1, arg2) {
    wasm.closure20_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_37(arg0, arg1) {
    wasm._dyn_core__ops__function__Fn_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h450b531118ea175a(arg0, arg1);
}

function __wbg_adapter_42(arg0, arg1, arg2) {
    wasm.closure241_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_45(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h3e106b9a82855b97(arg0, arg1);
}

function __wbg_adapter_171(arg0, arg1, arg2, arg3) {
    wasm.closure174_externref_shim(arg0, arg1, arg2, arg3);
}

const __wbindgen_enum_BinaryType = ["blob", "arraybuffer"];

const __wbindgen_enum_ReadableStreamType = ["bytes"];

const EpoxyClientFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_epoxyclient_free(ptr >>> 0, 1));

export class EpoxyClient {

    toJSON() {
        return {
            redirect_limit: this.redirect_limit,
            user_agent: this.user_agent,
            buffer_size: this.buffer_size,
        };
    }

    toString() {
        return JSON.stringify(this);
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EpoxyClientFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_epoxyclient_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get redirect_limit() {
        const ret = wasm.__wbg_get_epoxyclient_redirect_limit(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set redirect_limit(arg0) {
        wasm.__wbg_set_epoxyclient_redirect_limit(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {string}
     */
    get user_agent() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_epoxyclient_user_agent(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} arg0
     */
    set user_agent(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_epoxyclient_user_agent(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {number}
     */
    get buffer_size() {
        const ret = wasm.__wbg_get_epoxyclient_buffer_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set buffer_size(arg0) {
        wasm.__wbg_set_epoxyclient_buffer_size(this.__wbg_ptr, arg0);
    }
    /**
     * @param {EpoxyWispTransport} transport
     * @param {EpoxyClientOptions} options
     */
    constructor(transport, options) {
        _assertClass(options, EpoxyClientOptions);
        var ptr0 = options.__destroy_into_raw();
        const ret = wasm.epoxyclient_new(transport, ptr0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        EpoxyClientFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {Promise<void>}
     */
    replace_stream_provider() {
        const ret = wasm.epoxyclient_replace_stream_provider(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {EpoxyHandlers} handlers
     * @param {EpoxyUrlInput} url
     * @param {string[]} protocols
     * @param {EpoxyWebSocketHeadersInput} headers
     * @returns {Promise<EpoxyWebSocket>}
     */
    connect_websocket(handlers, url, protocols, headers) {
        _assertClass(handlers, EpoxyHandlers);
        var ptr0 = handlers.__destroy_into_raw();
        const ptr1 = passArrayJsValueToWasm0(protocols, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.epoxyclient_connect_websocket(this.__wbg_ptr, ptr0, url, ptr1, len1, headers);
        return ret;
    }
    /**
     * @param {EpoxyUrlInput} url
     * @returns {Promise<EpoxyIoStream>}
     */
    connect_tcp(url) {
        const ret = wasm.epoxyclient_connect_tcp(this.__wbg_ptr, url);
        return ret;
    }
    /**
     * @param {EpoxyUrlInput} url
     * @returns {Promise<EpoxyIoStream>}
     */
    connect_tls(url) {
        const ret = wasm.epoxyclient_connect_tls(this.__wbg_ptr, url);
        return ret;
    }
    /**
     * @param {EpoxyUrlInput} url
     * @returns {Promise<EpoxyIoStream>}
     */
    connect_udp(url) {
        const ret = wasm.epoxyclient_connect_udp(this.__wbg_ptr, url);
        return ret;
    }
    /**
     * @param {EpoxyUrlInput} url
     * @param {object} options
     * @returns {Promise<Response>}
     */
    fetch(url, options) {
        const ret = wasm.epoxyclient_fetch(this.__wbg_ptr, url, options);
        return ret;
    }
}

const EpoxyClientOptionsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_epoxyclientoptions_free(ptr >>> 0, 1));

export class EpoxyClientOptions {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EpoxyClientOptionsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_epoxyclientoptions_free(ptr, 0);
    }
    /**
     * @returns {boolean}
     */
    get wisp_v2() {
        const ret = wasm.__wbg_get_epoxyclientoptions_wisp_v2(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set wisp_v2(arg0) {
        wasm.__wbg_set_epoxyclientoptions_wisp_v2(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get udp_extension_required() {
        const ret = wasm.__wbg_get_epoxyclientoptions_udp_extension_required(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set udp_extension_required(arg0) {
        wasm.__wbg_set_epoxyclientoptions_udp_extension_required(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get title_case_headers() {
        const ret = wasm.__wbg_get_epoxyclientoptions_title_case_headers(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set title_case_headers(arg0) {
        wasm.__wbg_set_epoxyclientoptions_title_case_headers(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {boolean}
     */
    get ws_title_case_headers() {
        const ret = wasm.__wbg_get_epoxyclientoptions_ws_title_case_headers(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set ws_title_case_headers(arg0) {
        wasm.__wbg_set_epoxyclientoptions_ws_title_case_headers(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {string[]}
     */
    get websocket_protocols() {
        const ret = wasm.__wbg_get_epoxyclientoptions_websocket_protocols(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {string[]} arg0
     */
    set websocket_protocols(arg0) {
        const ptr0 = passArrayJsValueToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_epoxyclientoptions_websocket_protocols(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {number}
     */
    get redirect_limit() {
        const ret = wasm.__wbg_get_epoxyclientoptions_redirect_limit(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set redirect_limit(arg0) {
        wasm.__wbg_set_epoxyclientoptions_redirect_limit(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get header_limit() {
        const ret = wasm.__wbg_get_epoxyclientoptions_header_limit(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set header_limit(arg0) {
        wasm.__wbg_set_epoxyclientoptions_header_limit(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {string}
     */
    get user_agent() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.__wbg_get_epoxyclientoptions_user_agent(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @param {string} arg0
     */
    set user_agent(arg0) {
        const ptr0 = passStringToWasm0(arg0, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_epoxyclientoptions_user_agent(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {string[]}
     */
    get pem_files() {
        const ret = wasm.__wbg_get_epoxyclientoptions_pem_files(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @param {string[]} arg0
     */
    set pem_files(arg0) {
        const ptr0 = passArrayJsValueToWasm0(arg0, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.__wbg_set_epoxyclientoptions_pem_files(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {boolean}
     */
    get disable_certificate_validation() {
        const ret = wasm.__wbg_get_epoxyclientoptions_disable_certificate_validation(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} arg0
     */
    set disable_certificate_validation(arg0) {
        wasm.__wbg_set_epoxyclientoptions_disable_certificate_validation(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get buffer_size() {
        const ret = wasm.__wbg_get_epoxyclientoptions_buffer_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set buffer_size(arg0) {
        wasm.__wbg_set_epoxyclientoptions_buffer_size(this.__wbg_ptr, arg0);
    }
    constructor() {
        const ret = wasm.epoxyclientoptions_new_default();
        this.__wbg_ptr = ret >>> 0;
        EpoxyClientOptionsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const EpoxyHandlersFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_epoxyhandlers_free(ptr >>> 0, 1));

export class EpoxyHandlers {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EpoxyHandlersFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_epoxyhandlers_free(ptr, 0);
    }
    /**
     * @returns {Function}
     */
    get onopen() {
        const ret = wasm.__wbg_get_epoxyhandlers_onopen(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Function} arg0
     */
    set onopen(arg0) {
        wasm.__wbg_set_epoxyhandlers_onopen(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {Function}
     */
    get onclose() {
        const ret = wasm.__wbg_get_epoxyhandlers_onclose(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Function} arg0
     */
    set onclose(arg0) {
        wasm.__wbg_set_epoxyhandlers_onclose(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {Function}
     */
    get onerror() {
        const ret = wasm.__wbg_get_epoxyhandlers_onerror(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Function} arg0
     */
    set onerror(arg0) {
        wasm.__wbg_set_epoxyhandlers_onerror(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {Function}
     */
    get onmessage() {
        const ret = wasm.__wbg_get_epoxyhandlers_onmessage(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {Function} arg0
     */
    set onmessage(arg0) {
        wasm.__wbg_set_epoxyhandlers_onmessage(this.__wbg_ptr, arg0);
    }
    /**
     * @param {Function} onopen
     * @param {Function} onclose
     * @param {Function} onerror
     * @param {Function} onmessage
     */
    constructor(onopen, onclose, onerror, onmessage) {
        const ret = wasm.epoxyhandlers_new(onopen, onclose, onerror, onmessage);
        this.__wbg_ptr = ret >>> 0;
        EpoxyHandlersFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const EpoxyWebSocketFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_epoxywebsocket_free(ptr >>> 0, 1));

export class EpoxyWebSocket {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(EpoxyWebSocket.prototype);
        obj.__wbg_ptr = ptr;
        EpoxyWebSocketFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EpoxyWebSocketFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_epoxywebsocket_free(ptr, 0);
    }
    /**
     * @param {EpoxyWebSocketInput} payload
     * @returns {Promise<void>}
     */
    send(payload) {
        const ret = wasm.epoxywebsocket_send(this.__wbg_ptr, payload);
        return ret;
    }
    /**
     * @param {number} code
     * @param {string} reason
     * @returns {Promise<void>}
     */
    close(code, reason) {
        const ptr0 = passStringToWasm0(reason, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.epoxywebsocket_close(this.__wbg_ptr, code, ptr0, len0);
        return ret;
    }
}

const IntoUnderlyingByteSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingbytesource_free(ptr >>> 0, 1));

export class IntoUnderlyingByteSource {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingByteSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
    }
    /**
     * @returns {ReadableStreamType}
     */
    get type() {
        const ret = wasm.intounderlyingbytesource_type(this.__wbg_ptr);
        return __wbindgen_enum_ReadableStreamType[ret];
    }
    /**
     * @returns {number}
     */
    get autoAllocateChunkSize() {
        const ret = wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {ReadableByteStreamController} controller
     */
    start(controller) {
        wasm.intounderlyingbytesource_start(this.__wbg_ptr, controller);
    }
    /**
     * @param {ReadableByteStreamController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingbytesource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingbytesource_cancel(ptr);
    }
}

const IntoUnderlyingSinkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));

export class IntoUnderlyingSink {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IntoUnderlyingSink.prototype);
        obj.__wbg_ptr = ptr;
        IntoUnderlyingSinkFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSinkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsink_free(ptr, 0);
    }
    /**
     * @param {any} chunk
     * @returns {Promise<any>}
     */
    write(chunk) {
        const ret = wasm.intounderlyingsink_write(this.__wbg_ptr, chunk);
        return ret;
    }
    /**
     * @returns {Promise<any>}
     */
    close() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_close(ptr);
        return ret;
    }
    /**
     * @param {any} reason
     * @returns {Promise<any>}
     */
    abort(reason) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_abort(ptr, reason);
        return ret;
    }
}

const IntoUnderlyingSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));

export class IntoUnderlyingSource {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IntoUnderlyingSource.prototype);
        obj.__wbg_ptr = ptr;
        IntoUnderlyingSourceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsource_free(ptr, 0);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingsource_cancel(ptr);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_at_7d852dd9f194d43e = function(arg0, arg1) {
        const ret = arg0.at(arg1);
        return ret;
    };
    imports.wbg.__wbg_buffer_09165b52af8c5237 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_byobRequest_77d9adf63337edfb = function(arg0) {
        const ret = arg0.byobRequest;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_byteLength_e674b853d9c77e1d = function(arg0) {
        const ret = arg0.byteLength;
        return ret;
    };
    imports.wbg.__wbg_byteOffset_fd862df290ef848d = function(arg0) {
        const ret = arg0.byteOffset;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_call_7cccdd69e0791ae2 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_cancel_8a308660caa6cadf = function(arg0) {
        const ret = arg0.cancel();
        return ret;
    };
    imports.wbg.__wbg_catch_a6e601879b2610e9 = function(arg0, arg1) {
        const ret = arg0.catch(arg1);
        return ret;
    };
    imports.wbg.__wbg_close_2893b7d056a0627d = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_304cc1fef3466669 = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_5ce03e29be453811 = function() { return handleError(function (arg0) {
        arg0.close();
    }, arguments) };
    imports.wbg.__wbg_close_fa50b16598acbea1 = function(arg0) {
        const ret = arg0.close();
        return ret;
    };
    imports.wbg.__wbg_convertbodyinner_5ac115b40ef55699 = function() { return handleError(function (arg0) {
        const ret = convert_body_inner(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_convertstreamingbodyinner_35f48047027829fa = function() { return handleError(function (arg0) {
        const ret = convert_streaming_body_inner(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_crypto_574e78ad8b13b65f = function(arg0) {
        const ret = arg0.crypto;
        return ret;
    };
    imports.wbg.__wbg_data_432d9c3df2630942 = function(arg0) {
        const ret = arg0.data;
        return ret;
    };
    imports.wbg.__wbg_defineproperty_a2f62826474baf23 = function(arg0, arg1, arg2, arg3) {
        define_property(arg0, getStringFromWasm0(arg1, arg2), arg3);
    };
    imports.wbg.__wbg_enqueue_bb16ba72f537dc9e = function() { return handleError(function (arg0, arg1) {
        arg0.enqueue(arg1);
    }, arguments) };
    imports.wbg.__wbg_entriesofobjectinner_458a45ae30201853 = function(arg0, arg1) {
        const ret = entries_of_object_inner(arg1);
        const ptr1 = passArrayJsValueToWasm0(ret, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_epoxywebsocket_new = function(arg0) {
        const ret = EpoxyWebSocket.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_error_6c3479b09307ba0e = function(arg0, arg1) {
        console.error(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_from_2a5d3e218e67aa85 = function(arg0) {
        const ret = Array.from(arg0);
        return ret;
    };
    imports.wbg.__wbg_fromentries_f646a4c3005ec270 = function() { return handleError(function (arg0) {
        const ret = from_entries(arg0);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() { return handleError(function (arg0, arg1) {
        arg0.getRandomValues(arg1);
    }, arguments) };
    imports.wbg.__wbg_getReader_48e00749fe3f6089 = function() { return handleError(function (arg0) {
        const ret = arg0.getReader();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_getWriter_6ce182d0adc3f96b = function() { return handleError(function (arg0) {
        const ret = arg0.getWriter();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_b9b93047fe3cf45b = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_getdone_d47073731acd3e74 = function(arg0) {
        const ret = arg0.done;
        return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
    };
    imports.wbg.__wbg_getvalue_009dcd63692bee1f = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbg_href_e36b397abf414828 = function(arg0, arg1) {
        const ret = arg1.href;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_e14585432e3737fc = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Error_4d54113b22d20306 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Error;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Headers_7730b58b2f544659 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Headers;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Promise_935168b8f4b49db3 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Promise;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Url_a8a94b3a8d7be902 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof URL;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_e2d2a49132c1b256 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_log_04f12d4a78533f64 = function(arg0, arg1) {
        console.log(getStringFromWasm0(arg0, arg1));
    };
    imports.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(arg0) {
        const ret = arg0.msCrypto;
        return ret;
    };
    imports.wbg.__wbg_new_23a2665fac83c611 = function(arg0, arg1) {
        try {
            var state0 = {a: arg0, b: arg1};
            var cb0 = (arg0, arg1) => {
                const a = state0.a;
                state0.a = 0;
                try {
                    return __wbg_adapter_171(a, state0.b, arg0, arg1);
                } finally {
                    state0.a = a;
                }
            };
            const ret = new Promise(cb0);
            return ret;
        } finally {
            state0.a = state0.b = 0;
        }
    };
    imports.wbg.__wbg_new_405e22f390576ce2 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_92c54fc74574ef55 = function() { return handleError(function (arg0, arg1) {
        const ret = new WebSocket(getStringFromWasm0(arg0, arg1));
        return ret;
    }, arguments) };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_c68d7209be747379 = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newnoargs_105ed471475aaf50 = function(arg0, arg1) {
        const ret = new Function(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_d97e637ebe145a9a = function(arg0, arg1, arg2) {
        const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithintounderlyingsink_08f1a3e40fc70d83 = function(arg0) {
        const ret = new WritableStream(IntoUnderlyingSink.__wrap(arg0));
        return ret;
    };
    imports.wbg.__wbg_newwithintounderlyingsource_b47f6a6a596a7f24 = function(arg0, arg1) {
        const ret = new ReadableStream(IntoUnderlyingSource.__wrap(arg0), arg1);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_a381634e90c276d4 = function(arg0) {
        const ret = new Uint8Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithoptreadablestreamandinit_e7fabd7063fd0b3e = function() { return handleError(function (arg0, arg1) {
        const ret = new Response(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_newwithstrsequence_6e9d6479e1cf978d = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = new WebSocket(getStringFromWasm0(arg0, arg1), arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_node_905d3e251edff8a2 = function(arg0) {
        const ret = arg0.node;
        return ret;
    };
    imports.wbg.__wbg_now_71123b9940376874 = function(arg0) {
        const ret = arg0.now();
        return ret;
    };
    imports.wbg.__wbg_now_807e54c39636c349 = function() {
        const ret = Date.now();
        return ret;
    };
    imports.wbg.__wbg_now_d18023d54d4e5500 = function(arg0) {
        const ret = arg0.now();
        return ret;
    };
    imports.wbg.__wbg_objectget_4091a43b212d1d52 = function(arg0, arg1, arg2) {
        const ret = object_get(arg0, getStringFromWasm0(arg1, arg2));
        return ret;
    };
    imports.wbg.__wbg_objectset_80c5574797dcbc85 = function(arg0, arg1, arg2, arg3) {
        object_set(arg0, getStringFromWasm0(arg1, arg2), arg3);
    };
    imports.wbg.__wbg_of_66b3ee656cbd962b = function(arg0, arg1) {
        const ret = Array.of(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbg_performance_1a2515c93daf8b0c = function(arg0) {
        const ret = arg0.performance;
        return ret;
    };
    imports.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(arg0) {
        const ret = arg0.process;
        return ret;
    };
    imports.wbg.__wbg_push_737cfc8c1432c2c6 = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_queueMicrotask_97d92b4fcc8a61c5 = function(arg0) {
        queueMicrotask(arg0);
    };
    imports.wbg.__wbg_queueMicrotask_d3219def82552485 = function(arg0) {
        const ret = arg0.queueMicrotask;
        return ret;
    };
    imports.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() { return handleError(function (arg0, arg1) {
        arg0.randomFillSync(arg1);
    }, arguments) };
    imports.wbg.__wbg_read_a2434af1186cb56c = function(arg0) {
        const ret = arg0.read();
        return ret;
    };
    imports.wbg.__wbg_readyState_7ef6e63c349899ed = function(arg0) {
        const ret = arg0.readyState;
        return ret;
    };
    imports.wbg.__wbg_ready_480b0e63c18378c7 = function(arg0) {
        const ret = arg0.ready;
        return ret;
    };
    imports.wbg.__wbg_releaseLock_091899af97991d2e = function(arg0) {
        arg0.releaseLock();
    };
    imports.wbg.__wbg_releaseLock_a389e6ea62ce0f4d = function(arg0) {
        arg0.releaseLock();
    };
    imports.wbg.__wbg_require_60cc747a6bc5215a = function() { return handleError(function () {
        const ret = module.require;
        return ret;
    }, arguments) };
    imports.wbg.__wbg_resolve_4851785c9c5f573d = function(arg0) {
        const ret = Promise.resolve(arg0);
        return ret;
    };
    imports.wbg.__wbg_respond_1f279fa9f8edcb1c = function() { return handleError(function (arg0, arg1) {
        arg0.respond(arg1 >>> 0);
    }, arguments) };
    imports.wbg.__wbg_send_fc0c204e8a1757f4 = function() { return handleError(function (arg0, arg1, arg2) {
        arg0.send(getArrayU8FromWasm0(arg1, arg2));
    }, arguments) };
    imports.wbg.__wbg_setTimeout_efd7c11531df1743 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.setTimeout(arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_setbinaryType_92fa1ffd873b327c = function(arg0, arg1) {
        arg0.binaryType = __wbindgen_enum_BinaryType[arg1];
    };
    imports.wbg.__wbg_setheaders_3b47c898e8de6d44 = function(arg0, arg1) {
        arg0.headers = arg1;
    };
    imports.wbg.__wbg_sethighwatermark_793c99c89830c8e9 = function(arg0, arg1) {
        arg0.highWaterMark = arg1;
    };
    imports.wbg.__wbg_setonclose_14fc475a49d488fc = function(arg0, arg1) {
        arg0.onclose = arg1;
    };
    imports.wbg.__wbg_setonerror_8639efe354b947cd = function(arg0, arg1) {
        arg0.onerror = arg1;
    };
    imports.wbg.__wbg_setonmessage_6eccab530a8fb4c7 = function(arg0, arg1) {
        arg0.onmessage = arg1;
    };
    imports.wbg.__wbg_setonopen_2da654e1f39745d5 = function(arg0, arg1) {
        arg0.onopen = arg1;
    };
    imports.wbg.__wbg_setstatus_51b4fc011091cbb3 = function(arg0, arg1) {
        arg0.status = arg1;
    };
    imports.wbg.__wbg_setstatustext_0f3162c3db034880 = function(arg0, arg1, arg2) {
        arg0.statusText = getStringFromWasm0(arg1, arg2);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_88a902d13a557d07 = function() {
        const ret = typeof global === 'undefined' ? null : global;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0 = function() {
        const ret = typeof globalThis === 'undefined' ? null : globalThis;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_SELF_37c5d418e4bf5819 = function() {
        const ret = typeof self === 'undefined' ? null : self;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_static_accessor_WINDOW_5de37043a91a9c40 = function() {
        const ret = typeof window === 'undefined' ? null : window;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_subarray_aa9065fa9dc5df96 = function(arg0, arg1, arg2) {
        const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_tee_15d2d039bef462ae = function() { return handleError(function (arg0) {
        const ret = arg0.tee();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_then_44b73946d2fb3e7d = function(arg0, arg1) {
        const ret = arg0.then(arg1);
        return ret;
    };
    imports.wbg.__wbg_then_48b406749878a531 = function(arg0, arg1, arg2) {
        const ret = arg0.then(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_toString_c813bbd34d063839 = function(arg0) {
        const ret = arg0.toString();
        return ret;
    };
    imports.wbg.__wbg_versions_c01dfd4722a88165 = function(arg0) {
        const ret = arg0.versions;
        return ret;
    };
    imports.wbg.__wbg_view_fd8a56e8983f448d = function(arg0) {
        const ret = arg0.view;
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    imports.wbg.__wbg_write_311434e30ee214e5 = function(arg0, arg1) {
        const ret = arg0.write(arg1);
        return ret;
    };
    imports.wbg.__wbg_wskey_17893b8278fbfc31 = function(arg0) {
        const ret = ws_key();
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_wsprotocol_1e1751556307928a = function(arg0) {
        const ret = ws_protocol();
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_cb_drop = function(arg0) {
        const obj = arg0.original;
        if (obj.cnt-- == 1) {
            obj.a = 0;
            return true;
        }
        const ret = false;
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper1371 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 242, __wbg_adapter_42);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper4222 = function(arg0, arg1, arg2) {
        const ret = makeMutClosure(arg0, arg1, 242, __wbg_adapter_45);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper485 = function(arg0, arg1, arg2) {
        const ret = makeClosure(arg0, arg1, 21, __wbg_adapter_34);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper487 = function(arg0, arg1, arg2) {
        const ret = makeClosure(arg0, arg1, 21, __wbg_adapter_37);
        return ret;
    };
    imports.wbg.__wbindgen_closure_wrapper489 = function(arg0, arg1, arg2) {
        const ret = makeClosure(arg0, arg1, 21, __wbg_adapter_34);
        return ret;
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_1;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_array = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbindgen_is_falsy = function(arg0) {
        const ret = !arg0;
        return ret;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_is_undefined = function(arg0) {
        const ret = arg0 === undefined;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('epoxy.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    __wbg_finalize_init(instance, module);
}

export default __wbg_init;
export const info = { version: "2.1.18-1", minimal: 0===1, release: 1===1, commit: "e2d1d4e50a97be4a1a242eea6b212cfb77b78426" };

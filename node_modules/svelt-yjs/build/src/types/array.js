"use strict";
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
//# sourceMappingURL=array.js.map
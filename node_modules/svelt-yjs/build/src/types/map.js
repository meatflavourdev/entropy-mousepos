"use strict";
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
//# sourceMappingURL=map.js.map
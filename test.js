/*@flow*/
'use strict';
var Cjdnsplice = require('./index.js');

const PATH = [
    {"labelN":"0000.0000.0000.0015","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelN":"0000.0000.0000.008e","labelP":"0000.0000.0000.009e","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelN":"0000.0000.0000.00a2","labelP":"0000.0000.0000.0013","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelN":"0000.0000.0000.001d","labelP":"0000.0000.0000.001b","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelN":"0000.0000.0000.001b","labelP":"0000.0000.0000.00ee","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelN":"0000.0000.0000.001b","labelP":"0000.0000.0000.0019","encodingScheme":Cjdnsplice.SCHEMES.v358},
    {"labelP":"0000.0000.0000.0013","encodingScheme":Cjdnsplice.SCHEMES.v358}
];

const buildLabelTest = () => {
    const builtPath = Cjdnsplice.buildLabel(PATH);
    if (builtPath.label !== '0000.0003.64b5.10e5') { throw new Error("incorrect label"); }
};

const spliceTest = () => {
    const result = Cjdnsplice.splice.apply(null, [
        "0000.0000.0000.0015",
        "0000.0000.0000.008e",
        "0000.0000.0000.00a2",
        "0000.0000.0000.001d",
        "0000.0000.0000.0414",
        "0000.0000.0000.001b"
    ].reverse());
    if (result !== "0000.001b.0535.10e5") { throw new Error(); }
};

var randLabel = function () {
    var out = [];
    for (var i = 0; i < 4; i++) {
        var x = Math.random().toString(16);
        if (x.length < 6) { i--; continue; }
        out.push(x.substring(x.length-4));
    }
    return out.join('.');
};

var testBitsToLabel = function () {
    for (var i = 0; i < 1000; i++) {
        var x = randLabel();
        if (Cjdnsplice._bitsToLabel(Cjdnsplice._labelToBits(x)) !== x) {
            throw new Error(x);
        }
    }
};

const reEncode = (label, type) => {
    return Cjdnsplice.reEncode(label, Cjdnsplice.SCHEMES.v358, type);
};

const cannonicalize = (label) => {
    return reEncode(label, Cjdnsplice.FORM_CANNONICAL);
};

const bitsify = (num, width) => {
    if (width === 0) { return []; }
    const list = num.toString(2).split('').map(Number);
    if (list.length > width) { throw new Error(); }
    while (list.length < width) { list.unshift(0); }
    return list;
};

const reEncodeTest = () => {
    for (let schemeName in Cjdnsplice.SCHEMES) {
        if (schemeName === 'v358') { continue; }
        const scheme = Cjdnsplice.SCHEMES[schemeName];
        const biggestForm = scheme[scheme.length - 1];
        const max = (1 << biggestForm.bitCount) - 1;
        for (let i = 0; i < max; i++) {
            const dirBits = bitsify(i, biggestForm.bitCount);
            const pfxBits = bitsify(Number('0x' + biggestForm.prefix), biggestForm.prefixLen);
            const allBits = [ 1 ];
            Array.prototype.push.apply(allBits, dirBits);
            Array.prototype.push.apply(allBits, pfxBits);
            const fullLabel = Cjdnsplice._bitsToLabel(allBits);
            const forms = scheme.filter((form) => (form.bitCount >= (i).toString(2).length));
            forms.forEach((x) => {
                const f = scheme.indexOf(x);
                const med = Cjdnsplice.reEncode(fullLabel, scheme, f);
                if (Cjdnsplice.reEncode(med, scheme, scheme.length - 1) !== fullLabel) {
                    throw new Error();
                }
                forms.forEach((xx) => {
                    const ff = scheme.indexOf(xx);
                    if (ff >= f) { return; }
                    const sml = Cjdnsplice.reEncode(fullLabel, scheme, ff);
                    if (Cjdnsplice.reEncode(sml, scheme, scheme.length - 1) !== fullLabel) {
                        throw new Error();
                    }
                    if (Cjdnsplice.reEncode(sml, scheme, f) !== med) { throw new Error(); }
                    if (Cjdnsplice.reEncode(med, scheme, ff) !== sml) { throw new Error(); }
                });
            });
        }
    }
};

var reEncodeTest358 = () => {
    for (let i = 0; i < 256; i++) {
        if (i === 0) { continue; }
        const bits = (i).toString(2).split('').map((x)=>(Number(x)));
        let formNum;
        if (bits.length <= 3) {
            while (bits.length < 3) { bits.unshift(0); }
            bits.push(1);
            formNum = 0;
        } else if (bits.length <= 5) {
            while (bits.length < 5) { bits.unshift(0); }
            bits.push(1,0);
            formNum = 1;
        } else if (bits.length <= 8) {
            while (bits.length < 8) { bits.unshift(0); }
            bits.push(0,0);
            formNum = 2;
        } else {
            throw new Error(bits.length);
        }
        bits.unshift(1);
        while (bits.length < 64) { bits.unshift(0); }
        const label = Cjdnsplice._bitsToLabel(bits);
        let label2 = "";
        let label1 = "";
        if (formNum < 2) {
            label2 = reEncode(label, 2);
            if (reEncode(label2, formNum) !== label) { throw new Error(); }
            if (cannonicalize(label2) !== label) { throw new Error(); }
            if (formNum < 1) {
                label1 = reEncode(label, 1);
                if (reEncode(label2, 1) !== label1) { throw new Error(); }
                if (reEncode(label1, 2) !== label2) { throw new Error(); }
                if (reEncode(label1, 0) !== label) { throw new Error(); }
                if (cannonicalize(label1) !== label) { throw new Error(); }
            }
        }
        //console.log(label + " " + label2 + " " + label1);
    }
};

const routesThroughTest = () => {
    if (!Cjdnsplice.routesThrough("0000.001b.0535.10e5", "0000.0000.0000.0015")) { throw new Error(); }
    if (Cjdnsplice.routesThrough("0000.001b.0535.10e5", "0000.0000.0000.0013")) { throw new Error(); }
};

const unspliceTest = () => {
    const ARRAY = [
        "0000.0000.0000.0015",
        "0000.0000.0000.008e",
        "0000.0000.0000.00a2",
        "0000.0000.0000.001d",
        "0000.0000.0000.0414",
        "0000.0000.0000.001b"
    ];
    let val = "0000.001b.0535.10e5";
    ARRAY.forEach((x) => {
        val = Cjdnsplice.unsplice(val, x);
        //console.log(val);
    });
    if (val !== '0000.0000.0000.0001') { throw new Error(); }
};

cannonicalize("0000.0000.0000.009e");
cannonicalize("0000.0000.0000.041c");
buildLabelTest();
spliceTest();
testBitsToLabel();
reEncodeTest();
reEncodeTest358();
routesThroughTest();
unspliceTest();

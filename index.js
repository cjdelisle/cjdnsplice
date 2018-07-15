/*@flow*/
/*
 * You may redistribute this program and/or modify it under the terms of
 * the GNU General Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';

var CHAR_TO_BITS = {};
("0123456789abcdefABCDEF").split('').forEach(function (chr) {
    CHAR_TO_BITS[chr] = Number('0x1'+chr).toString(2).substring(1).split('').map((x)=>(Number(x)));
});

var _labelToBits = module.exports._labelToBits = function (label /*:string*/) {
    var out = [];
    label = label.replace(/\./g, '');
    for (var i = 0; i < label.length; i++) {
        out.push.apply(out, CHAR_TO_BITS[label[i]]);
    }
    return out;
};

var bitsToChar = function (array /*:Array<number>*/) {
    var num = 0;
    for (var i = 0; i < 4; i++) {
        num |= (array.pop() << i);
    }
    return num.toString(16);
};

var _bitsToLabel = module.exports._bitsToLabel = function (array /*:Array<number>*/) {
    array = array.slice(0);
    var chars = [];
    for (var i = 0; i < 16; i++) {
        if ((i % 4) === 0) { chars.unshift('.'); }
        chars.unshift(bitsToChar(array));
    }
    chars.pop();
    return chars.join('');
};

var errorArray = function () {
    return new Array(64).fill(1);
};

const spliceBits1 = (goHere, viaHere) => {
    goHere = goHere.slice(0);
    viaHere = viaHere.slice(0);
    while (viaHere.shift() === 0) { }
    goHere.push.apply(goHere, viaHere);
    while (goHere.shift() === 0) { }
    goHere.unshift(1);
    if (goHere.length >= 60) { return errorArray(); }
    while (goHere.length < 64) { goHere.unshift(0); }
    return goHere;
};

const _spliceBits = module.exports._spliceBits = function () {
    if (arguments.length < 2) { throw new Error("must have at least 2 args"); }
    let result = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
        result = spliceBits1(result, arguments[i]);
    }
    return result;
};

/*::
type EncodingForm = { bitCount: number, prefix: string, prefixLen: number };
type EncodingScheme = Array<EncodingForm>;
*/
var SCHEMES = module.exports.SCHEMES = Object.freeze({
    f4: [ { bitCount: 4, prefix: "", prefixLen: 0 } ],
    f8: [ { bitCount: 8, prefix: "", prefixLen: 0 } ],
    v48: [
        { bitCount: 4, prefix: "01", prefixLen: 1 },
        { bitCount: 8, prefix: "00", prefixLen: 1 },
    ],
    v358: [
        { bitCount: 3, prefix: "01", prefixLen: 1 },
        { bitCount: 5, prefix: "02", prefixLen: 2 },
        { bitCount: 8, prefix: "00", prefixLen: 2 }
    ],
    v37: [
        { bitCount: 3, prefix: "01", prefixLen: 1 },
        { bitCount: 7, prefix: "00", prefixLen: 1 }
    ]
});

const printScheme = module.exports.printScheme = (scheme /*:EncodingScheme*/) => {
    const schemeStr = JSON.stringify(scheme);
    for (let scheme in SCHEMES) {
        if (schemeStr === JSON.stringify(SCHEMES[scheme])) { return scheme; }
    }
    return JSON.stringify(scheme);
};

const splice = module.exports.splice = function (/*::...args: Array<string>*/) {
    const bits = Array.prototype.slice.call(arguments).map(_labelToBits);
    return _bitsToLabel(_spliceBits.apply(null, bits));
};

var getEncodingForm = module.exports.getEncodingForm =
    function (label /*:string | Array<number>*/, scheme /*:EncodingScheme*/)
{
    if (typeof(label) === 'string') {
        label = _labelToBits(label);
    }
    var lstr = label.join();
    for (var i = 0; i < scheme.length; i++) {
        var pfxStr = _labelToBits(scheme[i].prefix).slice(-(scheme[i].prefixLen)).join();
        if (lstr.endsWith(pfxStr)) { return i; }
    }
    return -1;
};

var fixLength = function (array, length) {
    while (array.length > length) {
        if (array.shift() !== 0) { throw new Error("length cannot be reduced"); }
    }
    while (array.length < length) { array.unshift(0); }
};

const FORM_CANNONICAL = module.exports.FORM_CANNONICAL = -5000;

const reEncode0 = (labelStr /*:string*/, scheme /*EncodingScheme*/, desiredFormNum /*:number*/) => {
    const formN = getEncodingForm(labelStr, scheme);
    if (formN < 0) { throw new Error("could not detect encoding form"); }

    const label = _labelToBits(labelStr);
    const form = scheme[formN];
    let dir = label.splice(-(form.bitCount + form.prefixLen));
    dir.splice(dir.length - form.prefixLen);

    let desiredFormN;
    if (desiredFormNum === FORM_CANNONICAL) {
        desiredFormN = -1;
        const bitLen = dir.join('').replace(/^0+/, '').length;
        for (let i = 0; i < scheme.length; i++) {
            if (!scheme[i]) { continue; }
            if (scheme[i].bitCount < bitLen) { continue; }
            if (desiredFormN > -1 && scheme[i].bitCount >= scheme[desiredFormN].bitCount) {
                continue;
            }
            desiredFormN = i;
        }
    } else {
        desiredFormN = desiredFormNum;
    }
    const desiredForm = scheme[desiredFormN];
    if (!desiredForm) { throw new Error("invalid desiredFormNum"); }
    if (printScheme(scheme) === "v358") {
        // Special magic for SCHEME_358 legacy.
        if (desiredFormN === 0 && dir.join('') === '00111' || dir.join('') === '00000111') {
            // This is a special case where encodingForm 2 looks usable but it is not
            // because number 0001 is reserved for the self-route.
            desiredFormN = 1;
        }
        if (formN === 0 || desiredFormN === 0) {

            let dirN = Number('0x' + _bitsToLabel(dir).replace(/\./g, ''));
            if (formN === 0) {
                switch (dirN) {
                    case 0: throw new Error("cannot re-encode self-route");
                    case 1: dirN = 0; break;
                    default: dirN--; break;
                }
            }
            if (desiredFormN === 0) {
                switch (dirN) {
                    case 0: dirN = 1; break;
                    default: dirN++; break;
                }
            }
            dir = dirN.toString(2).split('').map((x)=>(Number(x)));
        }
    }
    fixLength(dir, desiredForm.bitCount);
    label.push.apply(label, dir);
    label.push.apply(label, _labelToBits(desiredForm.prefix).splice(-desiredForm.prefixLen));
    fixLength(label, 60);
    fixLength(label, 64);
    const out = _bitsToLabel(label);

    if (0) {
        console.log("reEncode(" + labelStr + " " + printScheme(scheme) + " " + desiredFormNum +
            ") -> " + out);
    }
    return out;
};

const reEncode = module.exports.reEncode =
    (labelStr /*:string*/, scheme /*:EncodingScheme*/, desiredFormNum /*:number*/) => {
    try {
        return reEncode0(labelStr, scheme, desiredFormNum);
    } catch (e) {
        console.log(e.stack);
        throw new Error("Failed to reencode " + labelStr + " to form " + desiredFormNum +
            " in scheme " + printScheme(scheme));
    }
};

const isOneHop = module.exports.isOneHop =
    (label /*:string*/ , encodingScheme /*:EncodingScheme*/) => {
    const formNum = getEncodingForm(label, encodingScheme);
    if (formNum < 0) { throw new Error("not a valid label for the given scheme"); }
    const form = encodingScheme[formNum];
    const bits = form.bitCount + form.prefixLen;
    const labelBits = _labelToBits(label);
    for (let i = 0; i < labelBits.length - bits - 1; i++) {
        if (labelBits[i]) { return false; }
    }
    return true;
};

/*::
type PathHop = { labelP?: string, key?: string, encodingScheme: EncodingScheme, labelN?: string };
*/
const buildLabel = module.exports.buildLabel = (pathArray /*:Array<PathHop>*/) => {
    const path = [];
    pathArray.forEach(function (hop, i) {
        let labelN = hop.labelN;
        if (!labelN) {
            if (i < pathArray.length - 1) { throw new Error("every hop must have labelN"); }
            return;
        }
        if (hop.labelP) {
            const formP = getEncodingForm(hop.labelP, hop.encodingScheme);
            const formN = getEncodingForm(labelN, hop.encodingScheme);
            const bitsP = hop.encodingScheme[formP].bitCount + hop.encodingScheme[formP].prefixLen;
            const bitsN = hop.encodingScheme[formN].bitCount + hop.encodingScheme[formN].prefixLen;
            if (bitsP > bitsN) {
                //console.log(JSON.stringify(pathArray));
                labelN = reEncode(labelN, hop.encodingScheme, formP);
            }
        }
        path.push(labelN);
    });
    //console.log(JSON.stringify(path));
    let result = path[0];
    if (path.length > 1) {
        result = splice.apply(null, path.slice(0).reverse());
    }
    return { label: result, path: path };
};

const routesThrough = module.exports.routesThrough = (dest /*:string*/, midPath /*:string*/) => {
    const d = _labelToBits(dest);
    const m = _labelToBits(midPath);
    for (let i = 0; i < m.length; i++) {
        if (!m[i]) { continue; }
        return d.slice(i + 1).join('') === m.slice(i + 1).join('');
    }
    return false;
};

const unsplice = module.exports.unsplice = (dest /*:string*/, midPath /*:string*/) => {
    const d = _labelToBits(dest);
    const m = _labelToBits(midPath);
    let sliced;
    for (let i = 0; i < m.length; i++) {
        if (!m[i]) { continue; }
        sliced = d.slice(0, i + 1);
        if (d.slice(i + 1).join('') !== m.slice(i + 1).join('')) {
            throw new Error("impossible to unsplice " + dest + " " + midPath);
        }
        break;
    }
    if (!sliced) { throw new Error("impossible to unsplice " + dest + " " + midPath); }
    while (sliced.length < 64) { sliced.unshift(0); }
    return _bitsToLabel(sliced);
};
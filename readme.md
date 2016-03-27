# Cjdnsplice - Tools for manipulating and splicing cjdns switch labels.

## Fields

### **SCHEME_358**
The encoding scheme consisting of 3, 5 or 8 bit data spaces, this encoding scheme is special
because it encodes strangely (a bug) and thus conversion from one form to another is non-standard.

## Functions

### splice(label1, label2, ...)
This function takes one or more labels and splices them to create a resulting label.
If you have a peer at `0000.0000.0000.0013` and he has a peer at `0000.0000.0000.0015` which you
want to reach, you can splice a label for reaching him using
`splice("0000.0000.0000.0015", "0000.0000.0000.0013")`. Remember that the arguments should be read
right to left, the first hop is the furthest to the right in the splice function. If the result
of the splicing is too long to fit in a label (60 bits) then it will return `ffff.ffff.ffff.ffff`.

```javascript
Cjdnsplice.splice("0000.0000.0000.0015", "0000.0000.0000.0013") -> '0000.0000.0000.0153'
```

Splice only works to splice a route if the return route is the same size or smaller. If the return
route is larger then the smaller director in the path must be re-encoded to be the same size as
the return path director. `buildLabel()` will take care of this automatically.

### printScheme(encodingScheme)
Prints the name of the encoding scheme if it is known, otherwise prints the JSON of the scheme.

```javascript
Cjdnsplice.printScheme(Cjdnsplice.SCHEME_358) -> 'SCHEME_358'
```

### isOneHop(label, encodingScheme)
Tests if a label contains only one hop, the first argument is the string representation of the
label and the second argument is the encoding scheme used by the node which is at the beginning
of the path given by the label.

```javascript
Cjdnsplice.isOneHop('0000.0000.0000.0013', Cjdnsplice.SCHEME_358) -> true
Cjdnsplice.isOneHop('0000.0000.0000.0015', Cjdnsplice.SCHEME_358) -> true
Cjdnsplice.isOneHop('0000.0000.0000.0153', Cjdnsplice.SCHEME_358) -> false
```

### getEncodingForm(label, encodingScheme)
Get the number of the encoding **form** used for the first *director* of the label. Recall an
encoding *scheme* is one or more encoding *forms*, this gets the number of that form or -1 if
the label is not recognized as using the given scheme.

```javascript
Cjdnsplice.getEncodingForm('0000.0000.0000.0013', Cjdnsplice.SCHEME_358) -> 2
Cjdnsplice.getEncodingForm('0000.0000.0000.0402', Cjdnsplice.SCHEME_358) -> 1
```

### reEncode(label, encodingScheme, desiredFormNum)
This will re-encode a label to the encoding *form* specified by **desiredFormNumber**. This form
is the same as numbered by `getEncodingForm()`. This may throw an error if the encoding form cannot
be detected, you pass an invalid **desiredFormNum** or if you try to re-encode the self route
(`0001`). It will also throw an error if re-encoding a label will make it too long (more than 60
bits)

```javascript
Cjdnsplice.reEncode("0000.0000.0000.0015", Cjdnsplice.SCHEME_358, 0) -> '0000.0000.0000.0404'
Cjdnsplice.reEncode("0000.0000.0000.0015", Cjdnsplice.SCHEME_358, 1) -> '0000.0000.0000.0086'
Cjdnsplice.reEncode("0000.0000.0000.0015", Cjdnsplice.SCHEME_358, 2) -> '0000.0000.0000.0015'
```

### buildLabel(pathArray)
This will construct a label using an array representation of a path, if any label along the path
needs to be re-encoded, it will be. Each element in the array represents a hop (node) in the path
and they each contain labelP and/or labelN depending on whether there is a previous and/or next
hop. labelP is necessary to know the width of the inverse path hop so that the label can be
re-encoded if necessary.

```javascript
Cjdnsplice.buildLabel([
    {"labelN":"0000.0000.0000.0015","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelN":"0000.0000.0000.008e","labelP":"0000.0000.0000.009e","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelN":"0000.0000.0000.00a2","labelP":"0000.0000.0000.0013","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelN":"0000.0000.0000.001d","labelP":"0000.0000.0000.001b","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelN":"0000.0000.0000.001b","labelP":"0000.0000.0000.00ee","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelN":"0000.0000.0000.001b","labelP":"0000.0000.0000.0019","encodingScheme":Cjdnsplice.SCHEME_358},
    {"labelP":"0000.0000.0000.0013","encodingScheme":Cjdnsplice.SCHEME_358}
]) -> { label: '0000.0003.64b5.10e5',
  path:
   [ '0000.0000.0000.0015',
     '0000.0000.0000.008e',
     '0000.0000.0000.00a2',
     '0000.0000.0000.001d',
     '0000.0000.0000.0092',
     '0000.0000.0000.001b' ] }
```

This function results in an Object containing 2 elements, "label" and "path". Label is the final
label for this path while "path" is the hops to get there. Notice in the "path" element, the second
to last hop hash been changed from `001b` to `0092`, this is a re-encoding to ensure that the label
remains the right length as the reverse path for this hop is `00ee` which is longer than `001b`.

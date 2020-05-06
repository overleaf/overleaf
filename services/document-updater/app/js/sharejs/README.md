This directory contains all the operational transform code. Each file defines a type.

Most of the types in here are for testing or demonstration. The only types which are sent to the webclient
are `text` and `json`.


# An OT type

All OT types have the following fields:

`name`: _(string)_ Name of the type. Should match the filename.
`create() -> snapshot`: Function which creates and returns a new document snapshot

`apply(snapshot, op) -> snapshot`: A function which creates a new document snapshot with the op applied
`transform(op1, op2, side) -> op1'`: OT transform function.

Given op1, op2, `apply(s, op2, transform(op1, op2, 'left')) == apply(s, op1, transform(op2, op1, 'right'))`.

Transform and apply must never modify their arguments.


Optional properties:

`tp2`: _(bool)_ True if the transform function supports TP2. This allows p2p architectures to work.
`compose(op1, op2) -> op`: Create and return a new op which has the same effect as op1 + op2.
`serialize(snapshot) -> JSON object`: Serialize a document to something we can JSON.stringify()
`deserialize(object) -> snapshot`: Deserialize a JSON object into the document's internal snapshot format
`prune(op1', op2, side) -> op1`: Inserse transform function. Only required for TP2 types.
`normalize(op) -> op`: Fix up an op to make it valid. Eg, remove skips of size zero.
`api`: _(object)_ Set of helper methods which will be mixed in to the client document object for manipulating documents. See below.


# Examples

`count` and `simple` are two trivial OT type definitions if you want to take a look. JSON defines
the ot-for-JSON type (see the wiki for documentation) and all the text types define different text
implementations. (I still have no idea which one I like the most, and they're fun to write!)


# API

Types can also define API functions. These methods are mixed into the client's Doc object when a document is created.
You can use them to help construct ops programatically (so users don't need to understand how ops are structured).

For example, the three text types defined here (text, text-composable and text-tp2) all provide the text API, supplying
`.insert()`, `.del()`, `.getLength` and `.getText` methods.

See text-api.coffee for an example.

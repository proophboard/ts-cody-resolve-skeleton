import {convertShorthandObjectToJsonSchema, convertShorthandStringToJsonSchema, dereferenceSchema} from "./jsonschema";
import {SchemaDefinitions} from "../types";
import {JSONSchema} from "json-schema-to-typescript";

const shorthandTypes = ['string', 'integer', 'number', 'boolean'];

test("it converts empty shorthand string to JSONSchema string", () => {
    const schema = convertShorthandStringToJsonSchema('', '/');

    expect(schema).toEqual({type: "string"});
})

test("It converts enum shorthand to JSONSchema string", () => {
    const schema = convertShorthandStringToJsonSchema("enum:available,blocked,bought", '/');

    expect(schema).toEqual({enum: ["available", "blocked", "bought"]})
})

test("It converts shorthand type to JSONSchema type", () => {
    shorthandTypes.forEach(type => {
        const schema = convertShorthandStringToJsonSchema(type, '/');

        expect(schema).toEqual({type});
    })

})

test("It converts nullable shorthand type to JSONSchema nullable type", () => {
    shorthandTypes.forEach(type => {
        const schema = convertShorthandStringToJsonSchema(type + '|null', '/');

        expect(schema).toEqual({type: [type, 'null']});
    })
})

test("It converts unknown type to JSONSchema ref", () => {
    const schema = convertShorthandStringToJsonSchema('User', '/');

    expect(schema).toEqual({"$ref": "#/definitions/User"});
})

test("It converts array shorthand type to JSONSchema array type", () => {
    shorthandTypes.forEach(type => {
        const schema = convertShorthandStringToJsonSchema(type + '[]', '/');

        expect(schema).toEqual({type: "array", items: {type}});
    })
})

test("It converts unknown shorthand array type to JSONSchema array with ref items", () => {
    const schema = convertShorthandStringToJsonSchema("User[]", '/');

    expect(schema).toEqual({type: "array", items: {"$ref": "#/definitions/User"}});
})

test("It parses shorthand validation and adds it to JSONSchema", () => {
    const stringSchema = convertShorthandStringToJsonSchema("string|format:email|maxLength:255", '/');

    expect(stringSchema).toEqual({type: "string", format: "email", maxLength: 255});

    const maxRoomsSchema = convertShorthandStringToJsonSchema("number|minimum:0.5|maximum:10", '/');

    expect(maxRoomsSchema).toEqual({type: "number", minimum: 0.5, maximum: 10});

    const nullableEmailSchema = convertShorthandStringToJsonSchema("string|null|format:email", '/');

    expect(nullableEmailSchema).toEqual({type: ["string", "null"], format: "email"})
})

test("It converts shorthand top level array to JSONSchema array", () => {
    const variants = ["Profile", "Profile[]"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$items": variant});

        expect(schema).toEqual({
            type: "array",
            items: {
                "$ref": "#/definitions/Profile"
            }
        })
    })
})

test("It converts shorthand top level array to JSONSchema array respecting given namespace", () => {
    const variants = ["Profile", "Profile[]"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$items": variant}, '/Custom');

        expect(schema).toEqual({
            type: "array",
            items: {
                "$ref": "#/definitions/Custom/Profile"
            }
        })
    })
})

test("It converts shorthand top level array to JSONSchema array respecting root namespace", () => {
    const variants = ["/Profile", "/Profile[]"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$items": variant}, '/Custom');

        expect(schema).toEqual({
            type: "array",
            items: {
                "$ref": "#/definitions/Profile"
            }
        })
    })
})

test("It converts shorthand top level array to JSONSchema array with relative namespace", () => {
    const variants = ["Sub/Profile", "Sub/Profile[]"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$items": variant}, '/Custom');

        expect(schema).toEqual({
            type: "array",
            items: {
                "$ref": "#/definitions/Custom/Sub/Profile"
            }
        })
    })
})

test("It converts top level reference to JSONSchema reference", () => {
    const variants = ["Profile", "#/definitions/Profile"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$ref": variant});

        expect(schema).toEqual({"$ref": "#/definitions/Profile"})
    })
})

test("It converts top level reference to JSONSchema reference respecting given namespace", () => {
    const variants = ["Profile"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$ref": variant}, "/Custom");

        expect(schema).toEqual({"$ref": "#/definitions/Custom/Profile"})
    })
})

test("It converts top level reference to JSONSchema reference respecting root namespace", () => {
    const variants = ["/Profile"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$ref": variant}, "/Custom");

        expect(schema).toEqual({"$ref": "#/definitions/Profile"})
    })
})

test("It converts top level reference to JSONSchema reference with relative namespace", () => {
    const variants = ["Sub/Profile"];

    variants.forEach(variant => {
        const schema = convertShorthandObjectToJsonSchema({"$ref": variant}, "/Custom");

        expect(schema).toEqual({"$ref": "#/definitions/Custom/Sub/Profile"})
    })
})

test("It converts shorthand object to JSONSchema object", () => {
    const schema = convertShorthandObjectToJsonSchema({
       name: "string|minLength:1",
       email: "string|format:email",
       "age?": "number|minimum:0",
       address: {
           zip: "string|minLength:1",
           city: "string|minLength:1",
       },
       tags: "string[]|minLength:1",
       "searchProfile?": {
           roomsMin: "number|null|minimum:0.5",
           roomsMax: "number|null|minimum:0.5",
       }
    });

    expect(schema).toEqual({
        type: "object",
        properties: {
            name: {
                type: "string",
                minLength: 1,
            },
            email: {
                type: "string",
                format: "email"
            },
            age: {
                type: "number",
                minimum: 0
            },
            address: {
                type: "object",
                properties: {
                    zip: {
                        type: "string",
                        minLength:1,
                    },
                    city: {
                        type: "string",
                        minLength:1
                    }
                },
                required: [
                    "zip",
                    "city"
                ],
                additionalProperties: false,
            },
            tags: {
                type: "array",
                items: {
                    type: "string",
                    minLength: 1
                }
            },
            searchProfile: {
                type: "object",
                properties: {
                    roomsMin: {
                        type: ["number", "null"],
                        minimum: 0.5,
                    },
                    roomsMax: {
                        type: ["number", "null"],
                        minimum: 0.5,
                    }
                },
                required: ["roomsMin", "roomsMax"],
                additionalProperties: false,
            }
        },
        required: [
            "name",
            "email",
            "address",
            "tags"
        ],
        additionalProperties: false,
    })
})

test("It converts shorthand object to JSONSchema object respecting given namespace", () => {
    const schema = convertShorthandObjectToJsonSchema({
        name: "string|minLength:1",
        address: "/Common/Address",
        "searchProfile?": "SearchProfile"
    }, "/Custom");

    expect(schema).toEqual({
        type: "object",
        properties: {
            name: {
                type: "string",
                minLength: 1,
            },
            address: {
                "$ref": "#/definitions/Common/Address"
            },
            searchProfile: {
                "$ref": "#/definitions/Custom/SearchProfile"
            }
        },
        required: [
            "name",
            "address",
        ],
        additionalProperties: false,
    })
})

test("It converts shorthand object to JSONSchema object respecting given namespace alternative version", () => {
    const schema = convertShorthandObjectToJsonSchema({
        name: "string|minLength:1",
        address: "Address|ns:/Common",
        "searchProfile?": "SearchProfile"
    }, "/Custom");

    expect(schema).toEqual({
        type: "object",
        properties: {
            name: {
                type: "string",
                minLength: 1,
            },
            address: {
                "$ref": "#/definitions/Common/Address"
            },
            searchProfile: {
                "$ref": "#/definitions/Custom/SearchProfile"
            }
        },
        required: [
            "name",
            "address",
        ],
        additionalProperties: false,
    })
})

test("It dereferences JSONSchema", (done) => {
    const defs: SchemaDefinitions  = {
        sourceMap: {
            "UserList": "/app/example/dist/src/model/values/UserList.ts",
            "Model/UserState": "/app/example/dist/src/model/User/UserState.ts",
            "User": "/app/example/dist/src/model/values/User.ts",
        },
        definitions: {
            "Model": {
                "UserState": {
                    "type": "object",
                    "properties": {
                        "userId": {
                            "type": "string"
                        },
                        "name": {
                            "type": "string"
                        }
                    },
                    "required": [
                        "userId",
                        "name"
                    ],
                    "additionalProperties": false,
                    "title": "UserState"
                }
            },
            "User": {
                "$ref": "#/definitions/Model/UserState",
                "title": "User"
            },
            "UserList": {
                "type": "array",
                "items": {
                    "$ref": "#/definitions/User"
                },
                "title": "UserList"
            }
        }
    };

    const schema: JSONSchema = {
        type: "array",
        "items": {
            "$ref": "#/definitions/User"
        }
    };

    dereferenceSchema(schema, defs).then(defSchema => {
        expect(defSchema.items).toEqual({
            "type": "object",
            "properties": {
                "userId": {
                    "type": "string"
                },
                "name": {
                    "type": "string"
                }
            },
            "required": [
                "userId",
                "name"
            ],
            "additionalProperties": false,
            "title": "User"
        });
        expect(schema.items).toEqual({"$ref": "#/definitions/User"});
        done();
    })
})


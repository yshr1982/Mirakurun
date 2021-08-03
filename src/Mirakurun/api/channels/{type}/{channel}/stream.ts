/*
   Copyright 2016 kanreisa

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import {Operation} from "express-openapi";
import * as api from "../../../../api";
import Channel from "../../../../Channel";
import { ChannelType, ChannelTypes } from "../../../../common";

export const parameters = [
    {
        in: "path",
        name: "type",
        type: "string",
        enum: Object.keys(ChannelTypes),
        required: true
    },
    {
        in: "path",
        name: "channel",
        type: "string",
        required: true
    },
    {
        in: "header",
        name: "X-Mirakurun-Priority",
        type: "integer",
        minimum: 0
    },
    {
        in: "query",
        name: "decode",
        type: "integer",
        minimum: 0,
        maximum: 1
    }
];

export const get: Operation = (req, res) => {

    const channel = Channel.get(req.params.type as ChannelType, req.params.channel);

    if (channel === null) {
        api.responseError(res, 404);
        return;
    }

    let requestAborted = false;
    req.once("close", () => requestAborted = true);

    const userId = (req.ip || "unix") + ":" + (req.connection.remotePort || Date.now());

    channel.getStream({
        id: userId,
        priority: parseInt(req.get("X-Mirakurun-Priority"), 10) || 0,
        agent: req.get("User-Agent"),
        url: req.url,
        disableDecoder: (<number> <any> req.query.decode === 0)
    })
        .then(stream => {
            if (requestAborted === true) {
                return stream.emit("close");
            }

            req.once("close", () => stream.emit("close"));

            res.setHeader("Content-Type", "video/MP2T");
            res.setHeader("X-Mirakurun-Tuner-User-ID", userId);
            res.status(200);
            stream.pipe(res);
        })
        .catch((err) => api.responseStreamErrorHandler(res, err));
};

get.apiDoc = {
    tags: ["channels", "stream"],
    operationId: "getChannelStream",
    produces: ["video/MP2T"],
    responses: {
        200: {
            description: "OK",
            headers: {
                "X-Mirakurun-Tuner-User-ID": {
                    type: "string"
                }
            }
        },
        404: {
            description: "Not Found"
        },
        503: {
            description: "Tuner Resource Unavailable"
        },
        default: {
            description: "Unexpected Error"
        }
    }
};

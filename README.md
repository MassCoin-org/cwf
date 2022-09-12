# cwf

[![wakatime](https://wakatime.com/badge/user/81d95bac-b8dd-495f-a6ea-b03daa3dc2ca/project/d6d935bb-3097-4066-a98f-e5a7684afa45.svg)](https://wakatime.com/badge/user/81d95bac-b8dd-495f-a6ea-b03daa3dc2ca/project/d6d935bb-3097-4066-a98f-e5a7684afa45)

The WIP web framework created to be used by [j4ce](https://github.com/j4cegh).

<b>Currently TypeScript only!</b>

# Setup Guide

- Create an npm project.
- Setup the folders more or less like this
  <br>

```
📦The Main Folder
 ┣ 📂components
 ┃ ┗ 📜Xyz.cwf
 ┣ 📂src
 ┃ ┗ 📜index.ts
 ┣ 📂views
 ┃ ┣ 📂api
 ┃ ┃ ┗ 📜test.ts
 ┃ ┗ 📜index.cwf
 ┣ 📜package-lock.json
 ┗ 📜package.json
```

- The index.ts file should look like this

```ts
import cwf from 'capy-wf';

const app = cwf({
  debug: true,
});

app.listen();
```

- Install ts-node-dev
  <br>
  `npm i --save-dev ts-node-dev`
- Add a dev script to the package.json file
  <br>
  `"dev": "ts-node-dev ./src/index.ts"`
- Run it!
  <br>
  `npm run dev`

# Api Example

Put the file in views/api/{apiName}.ts

Should look like this:

```ts
import { ApiContext } from 'capy-wf';

export default async function (ctx: ApiContext) {
  console.log(`Got: ${ctx.method}`);

  ctx.sendJson({
    hello: 'world',
  });
}
```

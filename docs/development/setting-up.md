# Setting up a dev environment

### Prerequisites

- git, any version
- Node.js >=24.21.0
- NPM >=11.18.0

### Setting up

If you use [nvm](https://github.com/nvm-sh/nvm), running following command inside this repository will automatically pick the right Node.js version for you:

```sh
 $ nvm use
```

#### Setup steps

1. `git clone https://github.com/swagger-api/swagger-client.git`
2. `cd swagger-client`
3. `npm install`
4. `npm run build`
5. `npm run test`

### Testing with Swagger-UI

It is often the case that after fixing a bug or implementing a new feature,
developer wants to test his changes in [Swagger-UI](https://github.com/swagger-api/swagger-ui).
This section will guide you through how to do that.

**1. Clone and install swagger-ui repository**

You'll find complete information about how to do that in swagger-ui [Setting up documentation](https://github.com/swagger-api/swagger-ui/blob/main/docs/development/setting-up.md).

**2. Clone and install swagger-client repository**

You'll find complete information about how to do that in [Steps](setting-up.md#steps) section of this document.

**3. Link repositories using npm link**

```shell script
 $ cd /path/to/swagger-client
 $ npm run build
 $ npm link
 $ cd /path/to/swagger-ui
 $ npm link swagger-client
```

**4. Make sure npm install is not running**

Open `/path/to/swagger-ui/package.json` in your favorite editor and look for `"predev": "npm install"`
script. Temporarily delete this line.

```shell script
 $ cd /path/to/swagger-ui
 $ npm run dev
``` 

You're now running your version of `swagger-client` inside `swagger-ui`. Test
what you need and continue with following step.

**5. Unlink repositories**

We have to clean up after we're done. Open `/path/to/swagger-ui/package.json` 
in your favorite editor and return back the `"predev": "npm install"` script.

```shell script
 $ cd /path/to/swagger-ui
 $ npm unlink --no-save swagger-client
 $ npm install
 $ cd /path/to/swagger-client
 $ npm unlink
```





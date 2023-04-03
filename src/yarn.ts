const cache = new Map();

async function findWorkspaceRoot(
  executeShellCommand: Fig.ExecuteShellCommandFunction
): Promise<string | null> {
  const stdout = await executeShellCommand(`yarn config get cacheFolder`);

  return stdout.substring(0, stdout.indexOf(".yarn"));
}

const stripTrailingSlash = (str) => {
  return str.endsWith("/") ? str.slice(0, -1) : str;
};

const completionSpec: Fig.Spec = {
  name: "yarn",
  description: "",
  generateSpec: async (_, executeShellCommand) => {
    const currentPath = await executeShellCommand("pwd");

    if (
      cache.has("workspaceRoot") &&
      !stripTrailingSlash(currentPath).includes(
        stripTrailingSlash(cache.get("workspaceRoot"))
      )
    ) {
      cache.delete("path");
      cache.delete("workspaceRoot");
      cache.delete("scripts");
    }

    if (!cache.has("path")) {
      const workspaceRoot = await findWorkspaceRoot(executeShellCommand);

      cache.set("path", currentPath);
      cache.set("workspaceRoot", workspaceRoot);
      cache.set("scripts", []);
    }

    if (cache.has("scripts") && cache.get("scripts").length !== 0) {
      return {
        name: "yarn",
        description: "",
        subcommands: cache.get("scripts").map((script) => ({
          name: script,
          description: "",
          icon: "✨",
        })),
      };
    }

    const workspacesOutput = await executeShellCommand(
      "yarn workspaces list --json -v"
    );

    const workspaces = workspacesOutput
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => JSON.parse(line));

    const workspacesScripts = await Promise.all(
      workspaces.map(async (workspace) => {
        const stdout = await executeShellCommand(
          `cat ${cache.get("workspaceRoot")}${workspace.location}/package.json`
        );

        try {
          const packageJson = JSON.parse(stdout);

          return packageJson.scripts;
        } catch (e) {
          return [];
        }
      })
    );

    const localScriptsOutput = await executeShellCommand("cat package.json");
    let localScripts = [];

    try {
      localScripts = JSON.parse(localScriptsOutput).scripts;
    } catch (e) {
      localScripts = [];
    }

    const scripts = [...workspacesScripts, localScripts]
      .filter((x) => !!x)
      .map((scrips) =>
        Object.keys(scrips).filter(
          (key) => !key.startsWith("_") && key.includes(":")
        )
      )
      .flat();

    const uniqueScripts = [...new Set(scripts)];

    if (!cache.has("scripts") || cache.get("scripts").length === 0) {
      cache.set("scripts", uniqueScripts);
    }

    return {
      name: "yarn",
      description: "",
      subcommands: uniqueScripts.map((script) => ({
        name: script,
        description: "",
        icon: "✨",
      })),
    };
  },
};

export default completionSpec;

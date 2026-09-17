export interface PackageManagerPolicy { online: boolean; allowBuild: boolean; lifecycleScripts: readonly string[] }

/** Describes the only package-manager policy accepted by the preflight runner. */
export function packageManagerPolicy(online: boolean, allowBuild: boolean): PackageManagerPolicy {
  return { online, allowBuild, lifecycleScripts: allowBuild ? ['preinstall', 'install', 'postinstall', 'prepare'] : [] }
}

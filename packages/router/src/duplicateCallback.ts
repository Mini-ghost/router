import { DuplicateCallback } from './types'

import { inject, onUnmounted, onActivated, onDeactivated, getCurrentInstance, ComponentOptions } from 'vue'
import { matchedRouteKey } from './injectionSymbols'
import { RouteRecordNormalized } from './matcher/types'
import { isRouteComponent } from './navigationGuards'
import { warn } from './warning'


function registerCallback(record: RouteRecordNormalized, name: 'duplicateCallback', callback: DuplicateCallback) {
  const removeFromList = () => {
    record[name].delete(callback)
  }

  onUnmounted(removeFromList)
  onDeactivated(removeFromList)

  onActivated(() => {
    record[name].add(callback)
  })

  record[name].add(callback)
}

export function onRouteUpdateDuplicate (duplicateCallback: DuplicateCallback) {
  if (__DEV__ && !getCurrentInstance()) {
    warn(
      'getCurrentInstance() returned null. onRouteUpdateDuplicate() must be called at the top of a setup function'
    )
    return
  }

  const activeRecord: RouteRecordNormalized | undefined = inject(
    matchedRouteKey,
    // to avoid warning
    {} as any
  ).value

  if (!activeRecord) {
    __DEV__ &&
      warn(
        'No active route record was found when calling `onRouteUpdateDuplicate()`. Make sure you call this function inside a component child of <router-view>. Maybe you called it inside of App.vue?'
      )
    return
  }

  registerCallback(activeRecord, 'duplicateCallback', duplicateCallback)
}

export function extractComponentsDuplicateCallback(
  matched: RouteRecordNormalized[]
) {
  const callbacks: DuplicateCallback[] = []

  for (const record of matched) {
    if (__DEV__ && !record.components && !record.children.length) {
      warn(
        `Record with path "${record.path}" is either missing a "component(s)"` +
          ` or "children" property.`
      )
    }
    for(const name in record.components) {
      let rawComponent = record.components[name]
      if (__DEV__) {
        if (
          !rawComponent ||
          (typeof rawComponent !== 'object' &&
            typeof rawComponent !== 'function')
        ) {
          warn(
            `Component "${name}" in record with path "${record.path}" is not` +
              ` a valid component. Received "${String(rawComponent)}".`
          )
          // throw to ensure we stop here but warn to ensure the message isn't
          // missed by the user
          throw new Error('Invalid route component')
        } else if ('then' in rawComponent) {
          // warn if user wrote import('/component.vue') instead of () =>
          // import('./component.vue')
          warn(
            `Component "${name}" in record with path "${record.path}" is a ` +
              `Promise instead of a function that returns a Promise. Did you ` +
              `write "import('./MyPage.vue')" instead of ` +
              `"() => import('./MyPage.vue')" ? This will break in ` +
              `production if not fixed.`
          )
          const promise = rawComponent
          rawComponent = () => promise
        } else if (
          (rawComponent as any).__asyncLoader &&
          // warn only once per component
          !(rawComponent as any).__warnedDefineAsync
        ) {
          ;(rawComponent as any).__warnedDefineAsync = true
          warn(
            `Component "${name}" in record with path "${record.path}" is defined ` +
              `using "defineAsyncComponent()". ` +
              `Write "() => import('./MyPage.vue')" instead of ` +
              `"defineAsyncComponent(() => import('./MyPage.vue'))".`
          )
        }
      }

      if(isRouteComponent(rawComponent)) {
        // __vccOpts is added by vue-class-component and contain the regular options
        const options: ComponentOptions =
        (rawComponent as any).__vccOpts || rawComponent

        const callback = options.routeUpdateDuplicate
        callback && callbacks.push(callback.bind(record.instances[name]))
      }

    }
  }

  return callbacks
}
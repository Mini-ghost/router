import { DuplicateCallback } from './types'

import { inject, onUnmounted, onActivated, onDeactivated, getCurrentInstance } from 'vue'
import { matchedRouteKey } from './injectionSymbols'
import { RouteRecordNormalized } from './matcher/types'
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
import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import { pluginsSortValidator } from '../../middlewares/validators'
import { PluginModel } from '../../models/server/plugin'
import { UserRight } from '../../../shared/models/users'
import {
  existingPluginValidator,
  installOrUpdatePluginValidator,
  listPluginsValidator,
  uninstallPluginValidator,
  updatePluginSettingsValidator
} from '../../middlewares/validators/plugins'
import { PluginManager } from '../../lib/plugins/plugin-manager'
import { InstallOrUpdatePlugin } from '../../../shared/models/plugins/install-plugin.model'
import { ManagePlugin } from '../../../shared/models/plugins/manage-plugin.model'
import { logger } from '../../helpers/logger'

const pluginRouter = express.Router()

pluginRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  listPluginsValidator,
  paginationValidator,
  pluginsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listPlugins)
)

pluginRouter.get('/:npmName',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  getPlugin
)

pluginRouter.get('/:npmName/registered-settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  asyncMiddleware(existingPluginValidator),
  getPluginRegisteredSettings
)

pluginRouter.put('/:npmName/settings',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  updatePluginSettingsValidator,
  asyncMiddleware(existingPluginValidator),
  asyncMiddleware(updatePluginSettings)
)

pluginRouter.post('/install',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(installPlugin)
)

pluginRouter.post('/update',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  installOrUpdatePluginValidator,
  asyncMiddleware(updatePlugin)
)

pluginRouter.post('/uninstall',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_PLUGINS),
  uninstallPluginValidator,
  asyncMiddleware(uninstallPlugin)
)

// ---------------------------------------------------------------------------

export {
  pluginRouter
}

// ---------------------------------------------------------------------------

async function listPlugins (req: express.Request, res: express.Response) {
  const type = req.query.type

  const resultList = await PluginModel.listForApi({
    type,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

function getPlugin (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  return res.json(plugin.toFormattedJSON())
}

async function installPlugin (req: express.Request, res: express.Response) {
  const body: InstallOrUpdatePlugin = req.body

  const fromDisk = !!body.path
  const toInstall = body.npmName || body.path
  try {
    const plugin = await PluginManager.Instance.install(toInstall, undefined, fromDisk)

    return res.json(plugin.toFormattedJSON())
  } catch (err) {
    logger.warn('Cannot install plugin %s.', toInstall, { err })
    return res.sendStatus(400)
  }
}

async function updatePlugin (req: express.Request, res: express.Response) {
  const body: InstallOrUpdatePlugin = req.body

  const fromDisk = !!body.path
  const toUpdate = body.npmName || body.path
  try {
    const plugin = await PluginManager.Instance.update(toUpdate, undefined, fromDisk)

    return res.json(plugin.toFormattedJSON())
  } catch (err) {
    logger.warn('Cannot update plugin %s.', toUpdate, { err })
    return res.sendStatus(400)
  }
}

async function uninstallPlugin (req: express.Request, res: express.Response) {
  const body: ManagePlugin = req.body

  await PluginManager.Instance.uninstall(body.npmName)

  return res.sendStatus(204)
}

function getPluginRegisteredSettings (req: express.Request, res: express.Response) {
  const settings = PluginManager.Instance.getRegisteredSettings(req.params.npmName)

  return res.json({
    settings
  })
}

async function updatePluginSettings (req: express.Request, res: express.Response) {
  const plugin = res.locals.plugin

  plugin.settings = req.body.settings
  await plugin.save()

  return res.sendStatus(204)
}
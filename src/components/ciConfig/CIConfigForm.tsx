import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { DOCUMENTATION } from '../../config'
import { getWorkflowList } from '../../services/service'
import { OptionType } from '../app/types'
import { CIBuildConfigType, CIBuildType, DockerConfigOverrideKeys } from '../ciPipeline/types'
import { ConfirmationDialog, Progressing, showError, useForm } from '../common'
import { saveCIConfig, updateCIConfig } from './service'
import { CIBuildArgType, CIConfigFormProps, ProcessedWorkflowsType } from './types'
import { processWorkflow } from '../app/details/triggerView/workflow.service'
import { WorkflowCreate } from '../app/details/triggerView/config'
import warningIconSrc from '../../assets/icons/ic-warning-y6.svg'
import { ReactComponent as BookOpenIcon } from '../../assets/icons/ic-book-open.svg'
import { ReactComponent as NextIcon } from '../../assets/icons/ic-arrow-right.svg'
import CIConfigDiffView from './CIConfigDiffView'
import CIContainerRegistryConfig from './CIContainerRegistryConfig'
import CIDockerFileConfig from './CIDockerFileConfig'
import {
    CI_CONFIG_FORM_VALIDATION,
    getCIConfigFormState,
    getTargetPlatformMap,
    initCurrentCIBuildConfig,
    processBuildArgs,
} from './CIConfig.utils'
import { useHistory } from 'react-router-dom'
import { STAGE_NAME } from '../app/details/appConfig/appConfig.type'

export default function CIConfigForm({
    parentReloading,
    dockerRegistries,
    sourceConfig,
    ciConfig,
    reload,
    appId,
    selectedCIPipeline,
    configOverrideWorkflows,
    configOverrideView,
    allowOverride,
    updateDockerConfigOverride,
    isCDPipeline,
    isCiPipeline,
    navItems,
    parentState,
    setParentState,
    setLoadingData,
}: CIConfigFormProps) {
    const history = useHistory()
    const currentMaterial =
        allowOverride && selectedCIPipeline?.isDockerConfigOverridden
            ? sourceConfig.material.find(
                  (material) => material.id === selectedCIPipeline.dockerConfigOverride?.ciBuildConfig?.gitMaterialId,
              )
            : ciConfig?.ciBuildConfig?.gitMaterialId
            ? sourceConfig.material.find((material) => material.id === ciConfig?.ciBuildConfig?.gitMaterialId)
            : sourceConfig.material[0]
    const [selectedMaterial, setSelectedMaterial] = useState(currentMaterial)
    const currentRegistry =
        allowOverride && selectedCIPipeline?.isDockerConfigOverridden
            ? dockerRegistries.find((reg) => reg.id === selectedCIPipeline.dockerConfigOverride?.dockerRegistry)
            : ciConfig && ciConfig.dockerRegistry
            ? dockerRegistries.find((reg) => reg.id === ciConfig.dockerRegistry)
            : dockerRegistries.find((reg) => reg.isDefault)
    const { state, disable, handleOnChange, handleOnSubmit } = useForm(
        getCIConfigFormState(ciConfig, selectedCIPipeline, currentMaterial, currentRegistry),
        CI_CONFIG_FORM_VALIDATION,
        onValidation,
    )
    const [args, setArgs] = useState<CIBuildArgType[]>([])
    const [buildEnvArgs, setBuildEnvArgs] = useState<CIBuildArgType[]>([])
    const [loading, setLoading] = useState(false)
    const targetPlatformMap = getTargetPlatformMap()
    let _selectedPlatforms = []
    let _customTargetPlatorm = false
    if (ciConfig?.ciBuildConfig?.dockerBuildConfig?.targetPlatform) {
        _selectedPlatforms = ciConfig.ciBuildConfig.dockerBuildConfig.targetPlatform.split(',').map((platformValue) => {
            _customTargetPlatorm = _customTargetPlatorm || !targetPlatformMap.get(platformValue)
            return { label: platformValue, value: platformValue }
        })
    }
    const [selectedTargetPlatforms, setSelectedTargetPlatforms] = useState<OptionType[]>(_selectedPlatforms)
    const [showCustomPlatformWarning, setShowCustomPlatformWarning] = useState<boolean>(_customTargetPlatorm)
    const [showCustomPlatformConfirmation, setShowCustomPlatformConfirmation] = useState<boolean>(false)
    const [showConfigOverrideDiff, setShowConfigOverrideDiff] = useState<boolean>(false)
    const [processedWorkflows, setProcessedWorkflows] = useState<ProcessedWorkflowsType>({
        processing: false,
        workflows: [],
    })
    const configOverridenPipelines = ciConfig?.ciPipelines?.filter((_ci) => _ci.isDockerConfigOverridden)
    const [currentCIBuildConfig, setCurrentCIBuildConfig] = useState<CIBuildConfigType>(
        initCurrentCIBuildConfig(allowOverride, ciConfig, selectedCIPipeline, selectedMaterial, state.dockerfile.value),
    )

    useEffect(() => {
        initBuildArgs()
    }, [])

    useEffect(() => {
        updateParentCIBuildTypeState()
    }, [currentCIBuildConfig.ciBuildType])

    const initBuildArgs = () => {
        // Docker build arguments
        setArgs(processBuildArgs(ciConfig?.ciBuildConfig?.dockerBuildConfig?.args))

        // Buildpack - build env arguments
        setBuildEnvArgs(processBuildArgs(currentCIBuildConfig.buildPackConfig?.args))
    }

    const updateParentCIBuildTypeState = () => {
        if (configOverrideView && setParentState) {
            setParentState({
                ...parentState,
                currentCIBuildType: currentCIBuildConfig.ciBuildType,
            })
        }
    }

    async function onValidation(state) {
        let args2 = args.map(({ k, v, keyError, valueError }, idx) => {
            if (v && !k) {
                keyError = 'This field is required'
            } else if (k && !v) {
                valueError = 'This field is required'
            }
            let arg = { k, v, keyError, valueError }
            return arg
        })
        const areArgsWrong = args2.some((arg) => arg.keyError || arg.valueError)
        if (areArgsWrong) {
            setArgs([...args2])
            return
        }
        let targetPlatforms = ''
        const targetPlatformsSet = new Set()
        for (let index = 0; index < selectedTargetPlatforms.length; index++) {
            const element = selectedTargetPlatforms[index]
            if (!targetPlatformsSet.has(element.value)) {
                targetPlatformsSet.add(element.value)
                targetPlatforms += element.value + (index + 1 === selectedTargetPlatforms.length ? '' : ',')
            }
        }
        if (showCustomPlatformWarning) {
            setShowCustomPlatformConfirmation(!showCustomPlatformConfirmation)
            if (!showCustomPlatformConfirmation) {
                return
            }
        }

        const _ciBuildConfig = { ...currentCIBuildConfig }
        if (_ciBuildConfig.ciBuildType === CIBuildType.BUILDPACK_BUILD_TYPE && _ciBuildConfig.buildPackConfig) {
            _ciBuildConfig[DockerConfigOverrideKeys.buildPackConfig] = {
                builderId: _ciBuildConfig.buildPackConfig.builderId,
                language: _ciBuildConfig.buildPackConfig.language,
                languageVersion: _ciBuildConfig.buildPackConfig.languageVersion,
                projectPath: projectPath.value || './',
                args: buildEnvArgs.reduce((agg, { k, v }) => {
                    if (k && v) agg[k] = v
                    return agg
                }, {}),
            }
        } else {
            _ciBuildConfig[DockerConfigOverrideKeys.dockerBuildConfig] = {
                ..._ciBuildConfig.dockerBuildConfig,
                dockerfileRelativePath: dockerfile.value.replace(/^\//, ''),
                dockerfilePath: `${selectedMaterial?.checkoutPath}/${dockerfile.value}`.replace('//', '/'),
                args: args.reduce((agg, { k, v }) => {
                    if (k && v) agg[k] = v
                    return agg
                }, {}),
                dockerfileRepository: repository.value,
                targetPlatform: targetPlatforms,
            }
        }

        const requestBody = {
            id: ciConfig?.id ?? null,
            appId: +appId ?? null,
            dockerRegistry: registry.value || '',
            dockerRepository: repository_name.value?.replace(/\s/g, '') || '',
            beforeDockerBuild: [],
            ciBuildConfig: _ciBuildConfig,
            afterDockerBuild: [],
            appName: '',
            ...(ciConfig && ciConfig.version ? { version: ciConfig.version } : {}),
        }
        setLoading(true)
        try {
            const saveOrUpdate = ciConfig && ciConfig.id ? updateCIConfig : saveCIConfig
            await saveOrUpdate(requestBody)
            toast.success('Successfully saved.')
            reload()

            if (!isCiPipeline) {
                const stageIndex = navItems.findIndex((item) => item.stage === STAGE_NAME.CI_CONFIG)
                history.push(navItems[stageIndex + 1].href)
            }
        } catch (err) {
            showError(err)
        } finally {
            setLoading(false)
        }
    }

    const renderConfirmationModal = (): JSX.Element => {
        return (
            <ConfirmationDialog>
                <ConfirmationDialog.Icon src={warningIconSrc} />
                <ConfirmationDialog.Body title="Please ensure you have set valid target platform for the build" />
                <span className="fs-14 cn-7 dc__block">Custom target platform(s):</span>
                {selectedTargetPlatforms.map((targetPlatform) =>
                    targetPlatformMap.get(targetPlatform.value) ? null : (
                        <span className="fs-13 cn-7 dc__block">{targetPlatform.value}</span>
                    ),
                )}
                <p className="fs-13 cn-7 lh-1-54 mt-20">
                    The build will fail if the target platform is invalid or unsupported.
                </p>
                <ConfirmationDialog.ButtonGroup>
                    <button
                        type="button"
                        className="cta cancel"
                        onClick={(e) => {
                            setShowCustomPlatformConfirmation(false)
                        }}
                    >
                        Go back
                    </button>
                    <button onClick={onValidation} className="cta ml-12 dc__no-decor">
                        Confirm save
                    </button>
                </ConfirmationDialog.ButtonGroup>
            </ConfirmationDialog>
        )
    }

    const processFetchedWorkflows = async () => {
        if (!processedWorkflows.processing) {
            try {
                setProcessedWorkflows({
                    ...processedWorkflows,
                    processing: true,
                })
                const { result } = await getWorkflowList(appId)
                const { workflows } = processWorkflow(result, ciConfig, null, null, WorkflowCreate, WorkflowCreate.workflow)

                setProcessedWorkflows({ processing: false, workflows })
            } catch (err) {
                showError(err)
            }
        }
    }

    const handleOnChangeConfig = (e) => {
        handleOnChange(e)

        if (updateDockerConfigOverride) {
            switch (e.target.name) {
                case DockerConfigOverrideKeys.repository_name:
                    updateDockerConfigOverride(DockerConfigOverrideKeys.dockerRepository, e.target.value)
                    break
                case DockerConfigOverrideKeys.projectPath:
                    updateDockerConfigOverride(DockerConfigOverrideKeys.projectPath, {
                        ...currentCIBuildConfig,
                        buildPackConfig: {
                            ...currentCIBuildConfig.buildPackConfig,
                            projectPath: e.target.value,
                        },
                    })
                    break
                case DockerConfigOverrideKeys.dockerfile:
                    updateDockerConfigOverride(DockerConfigOverrideKeys.dockerfileRelativePath, {
                        ...currentCIBuildConfig,
                        dockerBuildConfig: {
                            ...currentCIBuildConfig.dockerBuildConfig,
                            dockerfileRelativePath: e.target.value,
                        },
                    })
                    break
                default:
                    break
            }
        }
    }

    const toggleConfigOverrideDiffModal = () => {
        setShowConfigOverrideDiff(!showConfigOverrideDiff)
        if (!showConfigOverrideDiff) {
            processFetchedWorkflows()
        }
    }

    const { repository, dockerfile, projectPath, registry, repository_name, key, value } = state
    return (
        <>
            <div className={`form__app-compose ${configOverrideView ? 'config-override-view' : ''}`}>
                {!configOverrideView && (
                    <div className="flex dc__content-space mb-20">
                        <h2 className="form__title m-0-imp">Build Configuration</h2>
                        <a
                            className="flex right dc__link"
                            rel="noreferrer noopener"
                            target="_blank"
                            href={DOCUMENTATION.APP_CREATE_CI_CONFIG}
                        >
                            <BookOpenIcon className="icon-dim-16 mr-8" />
                            <span>View documentation</span>
                        </a>
                    </div>
                )}
                <CIContainerRegistryConfig
                    appId={appId}
                    configOverrideView={configOverrideView}
                    ciConfig={ciConfig}
                    allowOverride={allowOverride}
                    configOverridenPipelines={configOverridenPipelines}
                    toggleConfigOverrideDiffModal={toggleConfigOverrideDiffModal}
                    updateDockerConfigOverride={updateDockerConfigOverride}
                    dockerRegistries={dockerRegistries}
                    registry={registry}
                    repository_name={repository_name}
                    currentRegistry={currentRegistry}
                    handleOnChangeConfig={handleOnChangeConfig}
                    isCDPipeline={isCDPipeline}
                />
                <CIDockerFileConfig
                    ciConfig={ciConfig}
                    sourceConfig={sourceConfig}
                    configOverrideView={configOverrideView}
                    allowOverride={allowOverride}
                    selectedCIPipeline={selectedCIPipeline}
                    currentMaterial={currentMaterial}
                    selectedMaterial={selectedMaterial}
                    setSelectedMaterial={setSelectedMaterial}
                    formState={state}
                    updateDockerConfigOverride={updateDockerConfigOverride}
                    args={args}
                    setArgs={setArgs}
                    buildEnvArgs={buildEnvArgs}
                    setBuildEnvArgs={setBuildEnvArgs}
                    handleOnChangeConfig={handleOnChangeConfig}
                    selectedTargetPlatforms={selectedTargetPlatforms}
                    setSelectedTargetPlatforms={setSelectedTargetPlatforms}
                    targetPlatformMap={targetPlatformMap}
                    showCustomPlatformWarning={showCustomPlatformWarning}
                    setShowCustomPlatformWarning={setShowCustomPlatformWarning}
                    currentCIBuildConfig={currentCIBuildConfig}
                    setCurrentCIBuildConfig={setCurrentCIBuildConfig}
                    setInProgress={configOverrideView ? setLoadingData : setLoading}
                />
            </div>
            {!configOverrideView && (
                <div className="save-build-configuration form__buttons dc__position-abs bcn-0 dc__border-top">
                    <button
                        tabIndex={5}
                        type="button"
                        className="flex cta h-36"
                        onClick={handleOnSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <Progressing />
                        ) : (
                            <>
                                {!isCiPipeline ? (
                                    <>
                                        Save & Next
                                        <NextIcon className="icon-dim-16 ml-5 scn-0" />
                                    </>
                                ) : (
                                    'Save Configuration'
                                )}
                            </>
                        )}
                    </button>
                </div>
            )}
            {showCustomPlatformConfirmation && renderConfirmationModal()}
            {configOverridenPipelines?.length > 0 && showConfigOverrideDiff && (
                <CIConfigDiffView
                    parentReloading={parentReloading}
                    ciConfig={ciConfig}
                    configOverridenPipelines={configOverridenPipelines}
                    configOverrideWorkflows={configOverrideWorkflows}
                    processedWorkflows={processedWorkflows}
                    toggleConfigOverrideDiffModal={toggleConfigOverrideDiffModal}
                    reload={reload}
                />
            )}
        </>
    )
}

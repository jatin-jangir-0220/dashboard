import React, { useEffect, useState } from 'react'
import moment from 'moment'
import { Link, useParams } from 'react-router-dom'
import { ModuleNameMap, Moment12HourFormat, URLS } from '../../../config'
import { getAppOtherEnvironment, getJobCIPiprline, getTeamList } from '../../../services/service'
import { handleUTCTime, Progressing, showError, sortOptionsByValue, stopPropagation, useAsync } from '../../common'
import { AppDetails, AppOverviewProps, JobPipeline, TagType } from '../types'
import { ReactComponent as EditIcon } from '../../../assets/icons/ic-pencil.svg'
import { ReactComponent as WorkflowIcon } from '../../../assets/icons/ic-workflow.svg'
import { ReactComponent as DescriptionIcon } from '../../../assets/icons/ic-note.svg'
import { ReactComponent as TagIcon } from '../../../assets/icons/ic-tag.svg'
import { ReactComponent as LinkedIcon } from '../../../assets/icons/ic-linked.svg'
import { ReactComponent as RocketIcon } from '../../../assets/icons/ic-nav-rocket.svg'
import { ReactComponent as InjectTag } from '../../../assets/icons/inject-tag.svg'
import { ReactComponent as SucceededIcon } from '../../../assets/icons/ic-success.svg'
import { ReactComponent as InProgressIcon } from '../../../assets/icons/ic-progressing.svg'
import { ReactComponent as FailedIcon } from '../../../assets/icons/ic-error-exclamation.svg'
import AboutAppInfoModal from '../details/AboutAppInfoModal'
import {
    ExternalLinkIdentifierType,
    ExternalLinksAndToolsType,
    ExternalLinkScopeType,
} from '../../externalLinks/ExternalLinks.type'
import { getExternalLinks, getMonitoringTools } from '../../externalLinks/ExternalLinks.service'
import { sortByUpdatedOn } from '../../externalLinks/ExternalLinks.utils'
import { AppLevelExternalLinks } from '../../externalLinks/ExternalLinks.component'
import './Overview.scss'
import AboutTagEditModal from '../details/AboutTagEditModal'
import Tippy from '@tippyjs/react'
import AppStatus from '../AppStatus'
import { StatusConstants } from '../list-new/Constants'
import { getModuleInfo } from '../../v2/devtronStackManager/DevtronStackManager.service'
import { ModuleStatus } from '../../v2/devtronStackManager/DevtronStackManager.type'
import { toast } from 'react-toastify'
import { createAppLabels } from '../service'

export default function AppOverview({ appMetaInfo, getAppMetaInfoRes, isJobOverview }: AppOverviewProps) {
    const { appId } = useParams<{ appId: string }>()
    const [isLoading, setIsLoading] = useState(true)
    const [currentLabelTags, setCurrentLabelTags] = useState<TagType[]>([])
    const [fetchingProjects, projectsListRes] = useAsync(() => getTeamList(), [appId])
    const [showUpdateAppModal, setShowUpdateAppModal] = useState(false)
    const [showUpdateTagModal, setShowUpdateTagModal] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [newDescription, setNewDescription] = useState<string>(appMetaInfo?.description)
    const [externalLinksAndTools, setExternalLinksAndTools] = useState<ExternalLinksAndToolsType>({
        fetchingExternalLinks: true,
        externalLinks: [],
        monitoringTools: [],
    })
    const [otherEnvsLoading, otherEnvsResult] = useAsync(
        () => Promise.all([getAppOtherEnvironment(appId), getModuleInfo(ModuleNameMap.ARGO_CD)]),
        [appId],
    )
    const isAgroInstalled: boolean = otherEnvsResult?.[1].result.status === ModuleStatus.INSTALLED
    const [jobPipelines, setJobPipelines] = useState<JobPipeline[]>([])

    useEffect(() => {
        getJobCIPiprline(appId)
            .then((response) => {
                setJobPipelines(response.result)
                setIsLoading(false)
            })
            .catch((error) => {
                console.error(error)
                setIsLoading(false)
            })
    }, [])

    useEffect(() => {
        if (appMetaInfo?.appName) {
            setCurrentLabelTags(appMetaInfo.labels)
            setNewDescription(appMetaInfo?.description)
            setIsLoading(false)
        }
    }, [appMetaInfo])

    useEffect(() => {
        getExternalLinksDetails()
    }, [appId])

    const getExternalLinksDetails = (): void => {
        Promise.all([getMonitoringTools(), getExternalLinks(0, appId, ExternalLinkIdentifierType.DevtronApp)])
            .then(([monitoringToolsRes, externalLinksRes]) => {
                setExternalLinksAndTools({
                    fetchingExternalLinks: false,
                    externalLinks:
                        externalLinksRes.result
                            ?.filter((_link) => _link.type === ExternalLinkScopeType.AppLevel)
                            ?.sort(sortByUpdatedOn) || [],
                    monitoringTools:
                        monitoringToolsRes.result
                            ?.map((tool) => ({
                                label: tool.name,
                                value: tool.id,
                                icon: tool.icon,
                            }))
                            .sort(sortOptionsByValue) || [],
                })
            })
            .catch((e) => {
                showError(e)
                setExternalLinksAndTools({
                    fetchingExternalLinks: false,
                    externalLinks: [],
                    monitoringTools: [],
                })
            })
    }

    const toggleChangeProjectModal = (e) => {
        stopPropagation(e)
        setShowUpdateAppModal(!showUpdateAppModal)
    }

    const toggleTagsUpdateModal = (e) => {
        stopPropagation(e)
        setShowUpdateTagModal(!showUpdateTagModal)
    }

    const renderInfoModal = () => {
        return (
            <AboutAppInfoModal
                isLoading={isLoading}
                appId={appId}
                appMetaInfo={appMetaInfo}
                onClose={toggleChangeProjectModal}
                getAppMetaInfoRes={getAppMetaInfoRes}
                fetchingProjects={fetchingProjects}
                projectsList={projectsListRes?.result}
                description={appMetaInfo.description}
            />
        )
    }

    const renderEditTagsModal = () => {
        return (
            <AboutTagEditModal
                isLoading={isLoading}
                appId={appId}
                appMetaInfo={appMetaInfo}
                onClose={toggleTagsUpdateModal}
                getAppMetaInfoRes={getAppMetaInfoRes}
                currentLabelTags={currentLabelTags}
                description={appMetaInfo.description}
            />
        )
    }

    const handleSave = async () => {
        try {
            const payload = {
                id: parseInt(appId),
                description: newDescription,
            }

            const appLabel = await createAppLabels(payload)

            setNewDescription(appLabel.result.description)

            setEditMode(false)
        } catch (error) {
            console.error(error)
            toast.error('Failed to update job description')
        }
    }

    const renderSideInfoColumn = () => {
        return (
            <div className="pt-16 pb-16 pl-20 pr-20 dc__border-right">
                <div className="mb-16">
                    {isJobOverview ? 'Job name' : 'App name'}
                    <div className="fs-13 fw-4 lh-20 cn-9">{appMetaInfo?.appName}</div>
                </div>
                <div className="mb-16">
                    <div className="fs-12 fw-4 lh-20 cn-7">Created on</div>
                    <div className="fs-13 fw-4 lh-20 cn-9">
                        {appMetaInfo?.createdOn ? moment(appMetaInfo.createdOn).format(Moment12HourFormat) : '-'}
                    </div>
                </div>
                <div className="mb-16">
                    <div className="fs-12 fw-4 lh-20 cn-7">Created by</div>
                    <div className="fs-13 fw-4 lh-20 cn-9">{appMetaInfo?.createdBy}</div>
                </div>
                <div className="mb-16">
                    <div className="fs-12 fw-4 lh-20 cn-7">Project</div>
                    <div className="flex left dc__content-space fs-13 fw-4 lh-20 cn-9">
                        {appMetaInfo?.projectName}
                        <EditIcon className="icon-dim-20 cursor" onClick={toggleChangeProjectModal} />
                    </div>
                </div>
            </div>
        )
    }

    const renderLabelTags = () => {
        return (
            <div className="flex column left pt-16 pb-16 pl-20 pr-20 dc__border-bottom-n1">
                <div className="flex left dc__content-space mb-12 w-100">
                    <div className="flex left fs-14 fw-6 lh-20 cn-9">
                        <TagIcon className="tags-icon icon-dim-20 mr-8" />
                        Tags
                    </div>
                    <div className="flex fs-12 fw-4 lh-16 cn-7 cursor" onClick={toggleTagsUpdateModal}>
                        <EditIcon className="icon-dim-16 scn-7 mr-4" />
                        Edit
                    </div>
                </div>
                <div className="flex left flex-wrap dc__gap-8">
                    {currentLabelTags.length > 0 ? (
                        currentLabelTags.map((tag) => (
                            <div className="flex">
                                <div
                                    className={`flex bc-n50 cn-9 fw-4 fs-12 en-2 bw-1 pr-6 pl-6 pb-2 pt-2 ${
                                        !tag.value ? ' br-4' : ' dc__left-radius-4'
                                    }`}
                                >
                                    {tag.propagate && <InjectTag className="icon-dim-16 mt-2 mr-4" />}
                                    <Tippy
                                        className="default-tt dc__word-break-all"
                                        arrow={false}
                                        placement="bottom"
                                        content={tag.key}
                                        trigger="mouseenter"
                                        interactive={true}
                                    >
                                        <div className="dc__mxw-400 dc__ellipsis-right">{tag.key}</div>
                                    </Tippy>
                                </div>
                                {tag.value && (
                                    <Tippy
                                        className="default-tt dc__word-break-all"
                                        arrow={false}
                                        placement="bottom"
                                        content={tag.value}
                                        trigger="mouseenter"
                                        interactive={true}
                                    >
                                        <div className="bcn-0 cn-9 fw-4 fs-12 en-2 bw-1 pr-6 pl-6 pb-2 pt-2 dc__right-radius-4 dc__no-left-border dc__mxw-400 dc__ellipsis-right">
                                            {tag.value}
                                        </div>
                                    </Tippy>
                                )}
                            </div>
                        ))
                    ) : (
                        <span className="fs-13 fw-4 cn-7">No tags added.</span>
                    )}
                </div>
            </div>
        )
    }

    // Update once new API changes are introduced
    const renderAppLevelExternalLinks = () => {
        return (
            <div className="flex column left pt-16 pb-16 pl-20 pr-20 dc__border-bottom-n1">
                <div className="flex left fs-14 fw-6 lh-20 cn-9 mb-12">
                    <LinkedIcon className="icon-dim-20 mr-8" />
                    External Links
                </div>
                {externalLinksAndTools.fetchingExternalLinks ? (
                    <div className="dc__loading-dots" />
                ) : (
                    <AppLevelExternalLinks
                        isOverviewPage={true}
                        appDetails={
                            {
                                appId: +appId,
                                appName: appMetaInfo?.appName,
                            } as AppDetails
                        }
                        externalLinks={externalLinksAndTools.externalLinks}
                        monitoringTools={externalLinksAndTools.monitoringTools}
                    />
                )}
            </div>
        )
    }

    const renderDeployedTime = (_env) => {
        if (_env.lastDeployed) {
            return handleUTCTime(_env.lastDeployed, true)
        } else {
            return isAgroInstalled ? '' : 'Not deployed'
        }
    }

    const renderDeploymentComponent = () => {
        if (otherEnvsResult[0].result?.length > 0) {
            return (
                <div className="env-deployments-info-wrapper w-100">
                    <div className="env-deployments-info-header display-grid dc__align-items-center dc__border-bottom-n1 dc__uppercase fs-12 fw-6 cn-7">
                        <span>Environment</span>
                        {isAgroInstalled && <span>App status</span>}
                        <span>Last deployed</span>
                    </div>
                    <div className="env-deployments-info-body">
                        {otherEnvsResult[0].result.map((_env) => (
                            <div
                                key={`${_env.environmentName}-${_env.environmentId}`}
                                className="env-deployments-info-row display-grid dc__align-items-center"
                            >
                                <Link to={`${URLS.APP}/${appId}/details/${_env.environmentId}/`} className="fs-13">
                                    {_env.environmentName}
                                </Link>
                                {isAgroInstalled && (
                                    <AppStatus
                                        appStatus={
                                            _env.lastDeployed
                                                ? _env.appStatus
                                                : StatusConstants.NOT_DEPLOYED.noSpaceLower
                                        }
                                    />
                                )}
                                <span className="fs-13 fw-4 cn-7">{renderDeployedTime(_env)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        return <div className="fs-13 fw-4 cn-7">This application has not been deployed yet.</div>
    }

    const renderEnvironmentDeploymentsStatus = () => {
        return (
            <div className="flex column left pt-16 pb-16 pl-20 pr-20">
                <div className="flex left fs-14 fw-6 lh-20 cn-9 mb-12">
                    <RocketIcon className="icon-dim-20 scn-9 mr-8" />
                    Deployments
                </div>
                {otherEnvsLoading ? <div className="dc__loading-dots" /> : renderDeploymentComponent()}
            </div>
        )
    }

    const renderWorkflowsStatus = () => {
        const renderWorkflowComponent = () => {
            if (isLoading) {
                return <div className="dc__loading-dots" />
            }
            if (jobPipelines != null) {
                return (
                    <div className="env-deployments-info-wrapper w-100">
                        <div className=" flex dc__border-bottom-n1 dc__uppercase fs-12 fw-6 cn-7 dc__content-space">
                            <div className="m-tb-3">Pipeline name</div>
                            <div className="flex">
                                <div className="m-tb-3 mr-16 w-150">Last run status</div>
                                <div className="w-150 m-tb-3">Last run at</div>
                            </div>
                        </div>
                        {jobPipelines.map((jobPipeline) => (
                            <div
                                key={jobPipeline.ci_pipeline_id}
                                className="dc__content-space flex dc__border-bottom-n1"
                            >
                                <div className="h-20 m-tb-3 ci-pipeline-name-color fs-13">
                                    {jobPipeline.ci_pipeline_name}
                                </div>
                                <div className="flex">
                                    <div className="mr-16 w-150 h-20 m-tb-3 fs-13 flex dc__content-start">
                                        {jobPipeline.status === 'Succeeded' && (
                                            <SucceededIcon className="dc__app-summary__icon icon-dim-20 mr-8" />
                                        )}
                                        {jobPipeline.status === 'Failed' && (
                                            <FailedIcon className="dc__app-summary__icon icon-dim-20 mr-8" />
                                        )}
                                        {jobPipeline.status === 'InProgres' && (
                                            <InProgressIcon className="dc__app-summary__icon icon-dim-20 mr-8" />
                                        )}
                                        {jobPipeline.status === 'Starting' && (
                                            <div className="dc__app-summary__icon icon-dim-20 mr-8 progressing" />
                                        )}
                                        {jobPipeline.status}
                                    </div>
                                    <div className="w-150 h-20 m-tb-3 fs-13">
                                        {jobPipeline.started_on !== '0001-01-01T00:00:00Z' &&
                                            handleUTCTime(jobPipeline.started_on, true)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
            return <div className="fs-13 fw-4 cn-7">No job pipelines are configured</div>
        }
        return (
            <div className="flex column left pt-16 pb-16 pl-20 pr-20">
                <div className="flex left fs-14 fw-6 lh-20 cn-9 mb-12">
                    <WorkflowIcon className="icon-dim-20 scn-9 mr-8" />
                    Job pipelines
                </div>
                {renderWorkflowComponent()}
            </div>
        )
    }

    if (!appMetaInfo || fetchingProjects) {
        return <Progressing pageLoader />
    }

    const renderJobDescription = () => {
        const handleCancel = () => {
            setNewDescription(newDescription)
            setEditMode(false)
        }

        return (
            <div className="flex column left pt-16 pb-16 pl-20 pr-20 dc__border-bottom-n1">
                <div className="flex left dc__content-space mb-12 w-100">
                    <div className="flex left fs-14 fw-6 lh-20 cn-9">
                        <DescriptionIcon className="tags-icon icon-dim-20 mr-8" />
                        Description
                    </div>
                    {editMode ? (
                        <div className="flex left ml-auto dc__gap-8">
                            <button className="btn btn-link p-0 fw-6 cn-7" onClick={handleCancel}>
                                Cancel
                            </button>
                            <button className="btn btn-link p-0 fw-6 cb-5" type="submit" onClick={handleSave}>
                                Save
                            </button>
                        </div>
                    ) : (
                        <div
                            className="flex fs-12 fw-4 lh-16 cn-7 cursor ml-auto"
                            onClick={() => {
                                setEditMode(true)
                            }}
                        >
                            <EditIcon className="icon-dim-16 scn-7 mr-4" />
                            Edit
                        </div>
                    )}
                </div>
                {editMode ? (
                    <div className="flex left flex-wrap dc__gap-8 w-100">
                        <textarea
                            placeholder="No description"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            className="flex left flex-wrap dc__gap-8 dc__description-textarea"
                        />
                    </div>
                ) : (
                    <div className="flex left flex-wrap dc__gap-8 w-100">
                        {newDescription ? newDescription : <span className="cn-7">No description</span>}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="app-overview-container display-grid bcn-0 dc__overflow-hidden">
            {renderSideInfoColumn()}
            <div className="app-overview-wrapper dc__overflow-scroll">
                {isJobOverview ? renderJobDescription() : renderLabelTags()}
                {isJobOverview ? renderLabelTags() : renderAppLevelExternalLinks()}
                {isJobOverview ? renderWorkflowsStatus() : renderEnvironmentDeploymentsStatus()}
            </div>
            {showUpdateAppModal && renderInfoModal()}
            {showUpdateTagModal && renderEditTagsModal()}
        </div>
    )
}

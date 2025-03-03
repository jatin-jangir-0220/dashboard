import React, { Component } from 'react'
import GitCommitInfoGeneric from '../../../common/GitCommitInfoGeneric'
import { SourceTypeMap } from '../../../../config'

export interface WebhookData {
    id: number
    eventActionType: string
    data: any
}

export interface CommitHistory {
    author: string
    commitURL: string
    changes: string[]
    commit: string
    date: string
    message: string
    isSelected: boolean
    showChanges: boolean
    webhookData: WebhookData
}

export interface CIMaterialType {
    id: number
    gitMaterialName: string
    gitMaterialId: number
    gitURL: string
    type: string
    value: string
    active: boolean
    history: CommitHistory[]
    isSelected: boolean
    lastFetchTime: string
    isRepoError?: boolean
    repoErrorMsg?: string
    isBranchError?: boolean
    branchErrorMsg?: string
    isMaterialLoading?: boolean
    regex: string
    searchText?: string
    noSearchResultsMsg?: string
    noSearchResult?: boolean
    isRegex: boolean
    isDockerFileError?: boolean
    dockerFileErrorMsg?: string
}

export interface MaterialHistoryProps {
    material: CIMaterialType
    pipelineName: string
    ciPipelineId?: string
    selectCommit?: (materialId: string, commit: string, ciPipelineId?: string) => void
    toggleChanges: (materialId: string, commit: string) => void
}

export class MaterialHistory extends Component<MaterialHistoryProps> {
    onClickMaterialHistory = (e, _commitId) => {
        e.stopPropagation()
        if (this.props.selectCommit) {
            this.props.selectCommit(this.props.material.id.toString(), _commitId, this.props.ciPipelineId)
        }
    }
    render() {
        return (
            <>
                {this.props.material.history.map((history) => {
                    let classes = `material-history mt-12 ${history.isSelected ? 'material-history-selected' : ''}`
                    if (this.props.selectCommit) {
                        classes = `${classes}`
                    }
                    let _commitId =
                        this.props.material.type == SourceTypeMap.WEBHOOK && history.webhookData
                            ? history.webhookData.id.toString()
                            : history.commit
                    return (
                        <div
                            key={_commitId}
                            className={`${classes} `}
                            onClick={(e) => this.onClickMaterialHistory(e, _commitId)}
                        >
                            <GitCommitInfoGeneric
                                materialUrl={this.props.material.gitURL}
                                showMaterialInfoHeader={false}
                                commitInfo={history}
                                materialSourceType={this.props.material.type}
                                selectedCommitInfo={this.props.selectCommit}
                                materialSourceValue={this.props.material.value}
                                canTriggerBuild={true}
                            />
                        </div>
                    )
                })}
            </>
        )
    }
}

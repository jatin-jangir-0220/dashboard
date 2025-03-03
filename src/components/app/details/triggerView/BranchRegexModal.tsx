import React, { useContext } from 'react'
import { ReactComponent as GitLab } from '../../../../assets/icons/git/gitlab.svg'
import { ReactComponent as Git } from '../../../../assets/icons/git/git.svg'
import { ReactComponent as GitHub } from '../../../../assets/icons/git/github.svg'
import { ReactComponent as BitBucket } from '../../../../assets/icons/git/bitbucket.svg'
import { SourceTypeMap } from '../../../../config'
import { ReactComponent as Close } from '../../../../assets/icons/ic-close.svg'
import { ReactComponent as LeftIcon } from '../../../../assets/icons/ic-arrow-backward.svg'
import { ReactComponent as Error } from '../../../../assets/icons/ic-alert-triangle.svg'
import { BranchRegexModalProps } from './types'
import { TriggerViewContext } from './config'
import { BRANCH_REGEX_MODAL_MESSAGING } from './Constants'
import { REQUIRED_FIELD_MSG } from '../../../../config/constantMessaging'

export default function BranchRegexModal({
    material,
    selectedCIPipeline,
    showWebhookModal,
    title,
    isChangeBranchClicked,
    onClickNextButton,
    onShowCIModal,
    handleRegexInputValue,
    regexValue,
    onCloseBranchRegexModal,
    hideHeaderFooter
}: BranchRegexModalProps) {
    const triggerViewContext = useContext(TriggerViewContext)

    const getBranchRegexName = (gitMaterialId: number): string => {
        if (Array.isArray(selectedCIPipeline?.ciMaterial)) {
            for (const _ciMaterial of selectedCIPipeline.ciMaterial) {
                if (
                    _ciMaterial.gitMaterialId === gitMaterialId &&
                    _ciMaterial.source &&
                    _ciMaterial.source?.type === SourceTypeMap.BranchRegex
                ) {
                    return _ciMaterial.source.regex
                }
            }
        }
        return ''
    }

    const _closeCIModal = () => {
        triggerViewContext.closeCIModal()
    }

    const renderBranchRegexMaterialHeader = () => {
      if (hideHeaderFooter) return null
      return (
          <div className="trigger-modal__header">
              <h1 className="modal__title flex left fs-16">{title}</h1>
              <button type="button" className="dc__transparent" onClick={_closeCIModal}>
                  <Close />
              </button>
          </div>
      )
    }

    const renderMaterialRegexFooterNextButton = () => {
        let _isDisabled = true

        for (let index = 0; index < material.length; index++) {
            const selectedMaterial = material[index]
            const _regexValue = regexValue[selectedMaterial.gitMaterialId] || {}
            _isDisabled = _regexValue.isInvalid
            if (_isDisabled) {
                break
            }
        }

        return (
            <div className="trigger-modal__trigger flex right">
                <button className="cta flex mr-20" onClick={onClickNextButton} disabled={_isDisabled}>
                    Save {!isChangeBranchClicked && '& Next'}
                    {!isChangeBranchClicked && (
                        <LeftIcon
                            style={{ ['--rotateBy' as any]: '180deg' }}
                            className={`rotate icon-dim-16 ml-8 ${_isDisabled ? 'scn-4' : 'scn-0'}`}
                        />
                    )}
                </button>
            </div>
        )
    }

    const renderValidationErrorLabel = (message: string): JSX.Element => {
        return (
            <div className="error-label flex left dc__align-start fs-11 fw-4 mt-6 ml-36">
                <Error className="icon-dim-16" />
                <div className="ml-4 cr-5">{message}</div>
            </div>
        )
    }

    const onClickBackArrow = (): void => {
        onCloseBranchRegexModal()
        onShowCIModal()
    }

    return (
        <>
            {renderBranchRegexMaterialHeader()}
            <div className="select-material--regex-body p-20 fs-13">
                <div className="flex left">
                    {isChangeBranchClicked && (
                        <div onClick={onClickBackArrow}>
                            <LeftIcon className="rotate icon-dim-20 mr-16 cursor" />
                        </div>
                    )}

                    <div>
                        <h4 className="mb-0 fw-6">{BRANCH_REGEX_MODAL_MESSAGING.SetPrimaryHeading}</h4>
                        <p className="mt-4">{BRANCH_REGEX_MODAL_MESSAGING.SetPrimaryInfoText}</p>
                    </div>
                </div>
                {material?.map((mat, index) => {
                    const _regexValue = regexValue[mat.gitMaterialId] || {}
                    return (
                        mat.regex && (
                            <div className="dc__border-bottom pb-20 pt-20" key={`regex_${index}`}>
                                <div className="flex left">
                                    <span className="mr-14">
                                        {mat.gitMaterialUrl.includes('gitlab') ? <GitLab /> : null}
                                        {mat.gitMaterialUrl.includes('github') ? <GitHub /> : null}
                                        {mat.gitMaterialUrl.includes('bitbucket') ? <BitBucket /> : null}
                                        {mat.gitMaterialUrl.includes('gitlab') ||
                                        mat.gitMaterialUrl.includes('github') ||
                                        mat.gitMaterialUrl.includes('bitbucket') ? null : (
                                            <Git />
                                        )}
                                    </span>
                                    <span>
                                        <div className="fw-6 fs-14">{mat.gitMaterialName}</div>
                                        <div className="pb-12">
                                            {BRANCH_REGEX_MODAL_MESSAGING.MatchingBranchName}&nbsp;
                                            <span className="fw-6">
                                                {getBranchRegexName(mat.gitMaterialId) || mat.regex}
                                            </span>
                                        </div>
                                    </span>
                                </div>
                                <input
                                    tabIndex={index}
                                    placeholder={BRANCH_REGEX_MODAL_MESSAGING.MatchingBranchNameRegex}
                                    className="form__input ml-36 w-95"
                                    name="name"
                                    value={_regexValue.value}
                                    onChange={(e) => handleRegexInputValue(mat.gitMaterialId, e.target.value, mat)}
                                    autoFocus
                                    autoComplete="off"
                                />
                                {_regexValue.value &&
                                    _regexValue.isInvalid &&
                                    renderValidationErrorLabel(BRANCH_REGEX_MODAL_MESSAGING.NoMatchingBranchName)}
                                {!_regexValue.value && renderValidationErrorLabel(REQUIRED_FIELD_MSG)}
                            </div>
                        )
                    )
                })}
            </div>
            {!showWebhookModal && !hideHeaderFooter && renderMaterialRegexFooterNextButton()}
        </>
    )
}

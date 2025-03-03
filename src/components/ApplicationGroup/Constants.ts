import { DeploymentNodeType } from '../app/details/triggerView/types'

export const ENV_TRIGGER_VIEW_GA_EVENTS = {
    MaterialClicked: {
        category: 'Environment Details Trigger View',
        action: 'Select Material Clicked',
    },
    ImageClicked: {
        category: 'Environment Details Trigger View',
        action: 'Select Image Clicked',
    },
    RollbackClicked: {
        category: 'Environment Details Trigger View',
        action: 'Select Rollback Material Clicked',
    },
    CITriggered: {
        category: 'Environment Details Trigger View',
        action: 'CI Triggered',
    },
    CDTriggered: (nodeType: string) => ({
        category: 'Environment Details Trigger View',
        action: `${nodeType} Triggered`,
    }),
    BulkCITriggered: {
        category: 'Environment Details Trigger View',
        action: 'Bulk CI Triggered',
    },
    BulkCDTriggered: (nodeType: string) => ({
        category: 'Environment Details Trigger View',
        action: `Bulk ${nodeType} Triggered`,
    }),
}

export const BUTTON_TITLE = {
    [DeploymentNodeType.PRECD]: 'Trigger pre-deployment stage',
    [DeploymentNodeType.CD]: 'Deploy',
    [DeploymentNodeType.POSTCD]: 'Trigger post-deployment stage',
}

export enum BulkResponseStatus {
    'PASS' = 'pass',
    'FAIL' = 'fail',
    'UNAUTHORIZE' = 'unauthorized',
}

export const BULK_CI_RESPONSE_STATUS_TEXT = {
    [BulkResponseStatus.PASS]: 'Build triggered',
    [BulkResponseStatus.FAIL]: 'Build not triggered',
    [BulkResponseStatus.UNAUTHORIZE]: 'Not authorized',
}

export const BULK_CD_RESPONSE_STATUS_TEXT = {
    [BulkResponseStatus.PASS]: 'Deployment triggered',
    [BulkResponseStatus.FAIL]: 'Deployment not triggered',
    [BulkResponseStatus.UNAUTHORIZE]: 'Not authorized',
}

export const BULK_CI_MESSAGING = {
    emptyLinkedCI: {
        title: 'is using a linked build pipeline',
        subTitle:
            'You can trigger the parent build pipeline. Triggering the parent build pipeline will trigger all build pipelines linked to it.',
        linkText: 'View Source Pipeline',
    },
    webhookCI: {
        title: 'is using a external build pipeline',
        subTitle: 'Images received from the external service will be available for deployment.',
    },
    isFirstTrigger: {
        infoText: 'First pipeline run',
        title: 'First pipeline run may take longer than usual',
        subTitle: 'Future runs will have shorter build time when cache is used.',
    },
    cacheNotAvailable: {
        infoText: 'Cache not available',
        title: 'Cache will be generated for this pipeline run',
        subTitle: 'Cache will be used in future runs to reduce build time.',
    },
}

export const BULK_CD_MESSAGING = {
    emptyPreDeploy: {
        title: 'does not have a pre-deployment stage',
        subTitle: 'This app does not have a pre-deployment stage',
    },
    emptyPostDeploy: {
        title: 'does not have a post-deployment stage',
        subTitle: 'This app does not have a post-deployment stage',
    },
    unauthorized: {
        title: 'Not authorized',
        subTitle: `You don't have permission to perform this action`,
    },
}

export const EMPTY_LIST_MESSAGING = {
    TITLE: 'No applications available',
    UNAUTHORIZE_TEXT: 'Not authorized',
    SUBTITLE: 'You don’t have access to any application in this app group.',
    NO_MATCHING_ENV: 'No matching env',
    NO_MATCHING_RESULT: 'We couldn’t find any matching results',
    EMPTY_ENV: 'Empty environment',
}

export const NO_ACCESS_TOAST_MESSAGE = {
    SUPER_ADMIN: 'There are no applications in this application group.',
    NON_ADMIN: 'You don’t have access to any application in this app group',
}

export const OVERVIEW_HEADER = {
    APPLICATION: 'application',
    APP_STATUS: 'app status',
    DEPLOYMENT_STATUS: 'deployment status',
    LAST_DEPLOYED: 'last deployed',
}

export const ENV_APP_GROUP_GA_EVENTS = {
    OverviewClicked: {
        category: 'Environment',
        action: 'Overview Clicked',
    },
    BuildDeployClicked: {
        category: 'Environment',
        action: 'Build & Deploy Clicked',
    },
    ConfigurationClicked: {
        category: 'Configuration',
        action: 'Configuration Clicked',
    },
}

export const GROUP_LIST_HEADER = {
    ENVIRONMENT: 'Environment',
    NAMESPACE: 'Namespace',
    CLUSTER: 'Cluster',
    APPLICATIONS: 'Applications',
    APPLICATION: 'Application'
}

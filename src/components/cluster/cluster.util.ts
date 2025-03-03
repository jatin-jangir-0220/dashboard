import { OptionType } from '../app/types';
import { ClusterComponentType, ClusterComponentStatusType, ClusterComponentStatus, ClusterTerminalParamsType } from './cluster.type';

export function getEnvName(components: ClusterComponentType[], agentInstallationStage): string {


    let nonTerminatingStatus: ClusterComponentStatusType[] = [];
    if (agentInstallationStage === 1) { //progressing
        nonTerminatingStatus = [ClusterComponentStatus.REQUEST_ACCEPTED, ClusterComponentStatus.ENQUEUED, ClusterComponentStatus.DEPLOY_INIT, ClusterComponentStatus.GIT_SUCCESS, ClusterComponentStatus.ACD_SUCCESS];
    }

    else if (agentInstallationStage === 2) { //success
        nonTerminatingStatus = [ClusterComponentStatus.DEPLOY_SUCCESS];
    }

    else if (agentInstallationStage === 3) { //failed
        nonTerminatingStatus = [ClusterComponentStatus.QUE_ERROR, ClusterComponentStatus.DEQUE_ERROR, ClusterComponentStatus.TRIGGER_ERROR, ClusterComponentStatus.GIT_ERROR, ClusterComponentStatus.ACD_ERROR];
    }

    let str = nonTerminatingStatus.join('');
    let c = components?.find(c => str.search(c.status) >= 0);
    return c?.envName;
}

export function getClusterTerminalParamsData(
    params: URLSearchParams,
    imageList: OptionType[],
    namespaceList: OptionType[],
    nodeList: { options: OptionType[]; label: string }[],
    clusterShellList: OptionType[],
    node: string,
): ClusterTerminalParamsType {
    const _selectedImage = imageList.find((image) => image.value === params.get('image'))
    const _selectedNamespace = namespaceList.find((namespace) => namespace.value === params.get('namespace'))
    let nodeOptionList: OptionType[] = []
    nodeList?.forEach((item) => nodeOptionList.push(...item.options))

    const _selectedNode: OptionType =
        nodeOptionList.find((data) => data.value === params.get('node')) ||
        (node ? nodeOptionList.find((item) => item.value === node) : nodeList[0].options[0])

    const _selectedShell = clusterShellList.find((shell) => shell.value === params.get('shell'))

    return {
        selectedImage: _selectedImage,
        selectedNamespace: _selectedNamespace,
        selectedNode: _selectedNode,
        selectedShell: _selectedShell,
    }
}

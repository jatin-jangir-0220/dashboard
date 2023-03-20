import React, { useState, useMemo, Component, useRef } from 'react'
import {
    showError,
    Pencil,
    useForm,
    Progressing,
    CustomPassword,
    VisibleModal,
    sortCallback,
    Toggle,
    useAsync,
    Drawer,
    Checkbox,
    DevtronSwitch as Switch,
    DevtronSwitchItem as SwitchItem,
    ButtonWithLoader,
} from '../common'
import { RadioGroup, RadioGroupItem } from '../common/formFields/RadioGroup'
import { List, CustomInput } from '../globalConfigurations/GlobalConfiguration'
import {
    getClusterList,
    saveCluster,
    updateCluster,
    saveEnvironment,
    updateEnvironment,
    getEnvironmentList,
    getCluster,
    retryClusterInstall,
    deleteCluster,
    deleteEnvironment,
} from './cluster.service'
import { ResizableTextarea } from '../configMaps/ConfigMap'
import { ReactComponent as Close } from '../../assets/icons/ic-close.svg'
import { ReactComponent as Add } from '../../assets/icons/ic-add.svg'
import { ReactComponent as Warning } from '../../assets/icons/ic-alert-triangle.svg'
import { ReactComponent as Database } from '../../assets/icons/ic-env.svg'
import { ReactComponent as ClusterIcon } from '../../assets/icons/ic-cluster.svg'
import { ReactComponent as FormError } from '../../assets/icons/ic-warning.svg'
import { ReactComponent as Error } from '../../assets/icons/ic-error-exclamation.svg'
import { ClusterComponentModal } from './ClusterComponentModal'
import { ClusterInstallStatus } from './ClusterInstallStatus'
import { ReactComponent as MechanicalOperation } from '../../assets/img/ic-mechanical-operation.svg'
import { POLLING_INTERVAL, ClusterListProps, AuthenticationType, DEFAULT_SECRET_PLACEHOLDER } from './cluster.type'
import { useHistory } from 'react-router'
import { toast } from 'react-toastify'
import {
    DOCUMENTATION,
    SERVER_MODE,
    ViewType,
    URLS,
    ModuleNameMap,
    CLUSTER_COMMAND,
    AppCreationType,
    MODES,
} from '../../config'
import { getEnvName } from './cluster.util'
import Reload from '../Reload/Reload'
import DeleteComponent from '../../util/DeleteComponent'
import {
    DC_CLUSTER_CONFIRMATION_MESSAGE,
    DC_ENVIRONMENT_CONFIRMATION_MESSAGE,
    DeleteComponentsName,
} from '../../config/constantMessaging'
import { ModuleStatus } from '../v2/devtronStackManager/DevtronStackManager.type'
import { getModuleInfo } from '../v2/devtronStackManager/DevtronStackManager.service'
import { ReactComponent as Question } from '../../assets/icons/ic-help-outline.svg'
import Tippy from '@tippyjs/react'
import ClusterInfoStepsModal from './ClusterInfoStepsModal'
import TippyHeadless from '@tippyjs/react/headless'
import CodeEditor from '../CodeEditor/CodeEditor'
import { DefaultViewTabsJSON } from '../v2/utils/tabUtils/tab.json'
import EmptyState from '../EmptyState/EmptyState'
import { ChartUploadResponse, UPLOAD_STATE } from '../CustomChart/types'
import { validate } from 'fast-json-patch'
import { validateChart } from '../CustomChart/customChart.service'

const PrometheusWarningInfo = () => {
    return (
        <div className="pt-10 pb-10 pl-16 pr-16 bcy-1 br-4 bw-1 dc__cluster-error mb-40">
            <div className="flex left dc__align-start">
                <Warning className="icon-dim-20 fcr-7" />
                <div className="ml-8 fs-13">
                    <span className="fw-6 dc__capitalize">Warning: </span>Prometheus configuration will be removed and
                    you won’t be able to see metrics for applications deployed in this cluster.
                </div>
            </div>
        </div>
    )
}

const PrometheusRequiredFieldInfo = () => {
    return (
        <div className="pt-10 pb-10 pl-16 pr-16 bcr-1 br-4 bw-1 er-2 mb-16">
            <div className="flex left dc__align-start">
                <Error className="icon-dim-20" />
                <div className="ml-8 fs-13">
                    Fill all the required fields OR turn off the above switch to skip configuring prometheus.
                </div>
            </div>
        </div>
    )
}

export default class ClusterList extends Component<ClusterListProps, any> {
    timerRef

    constructor(props) {
        super(props)
        this.state = {
            view: ViewType.LOADING,
            clusters: [],
            clusterEnvMap: {},
            showAddCluster: false,
            isTlsConnection: false,
            appCreationType: AppCreationType.Blank,
            isKubeConfigFile: false,
            getCluster: false,
            browseFile: false,
        }
        this.initialise = this.initialise.bind(this)
        this.toggleCheckTlsConnection = this.toggleCheckTlsConnection.bind(this)
        this.toggleShowAddCluster = this.toggleShowAddCluster.bind(this)
        this.toggleKubeConfigFile = this.toggleKubeConfigFile.bind(this)
        this.toggleGetCluster = this.toggleGetCluster.bind(this)
        this.toggleBrowseFile = this.toggleBrowseFile.bind(this)
    }

    componentDidMount() {
        this.initialise()
    }

    componentDidUpdate(prevProps) {
        if (this.props.serverMode !== prevProps.serverMode) {
            this.initialise()
        }
    }

    initialise() {
        if (this.timerRef) clearInterval(this.timerRef)
        Promise.all([
            getClusterList(),
            this.props.serverMode === SERVER_MODE.EA_ONLY ? { result: undefined } : getEnvironmentList(),
        ])
            .then(([clusterRes, envResponse]) => {
                let environments = envResponse.result || []
                const clusterEnvMap = environments.reduce((agg, curr, idx) => {
                    agg[curr.cluster_id] = agg[curr.cluster_id] || []
                    agg[curr.cluster_id].push(curr)
                    return agg
                }, {})
                let clusters = clusterRes.result || []
                clusters = clusters.concat({
                    id: null,
                    cluster_name: '',
                    server_url: '',
                    active: true,
                    config: {},
                    environments: [],
                })
                clusters = clusters.map((c) => {
                    return {
                        ...c,
                        environments: clusterEnvMap[c.id],
                    }
                })
                clusters = clusters.sort((a, b) => sortCallback('cluster_name', a, b))
                this.setState(
                    {
                        clusters: clusters,
                        clusterEnvMap,
                        view: ViewType.FORM,
                    },
                    () => {
                        let cluster = this.state.clusters.find(
                            (c) => c.agentInstallationStage === 1 || c.agentInstallationStage === 3,
                        )
                        if (cluster) {
                            this.timerRef = setInterval(() => {
                                this.pollClusterlist()
                            }, POLLING_INTERVAL)
                        }
                    },
                )
            })
            .catch((error) => {
                showError(error)
                this.setState({ view: ViewType.ERROR })
            })
    }

    async pollClusterlist() {
        //updates defaultComponents and agentInstallationStatus
        try {
            const { result } = await getClusterList()
            let clusters = result
                ? result.map((c) => {
                      return {
                          ...c,
                          environments: this.state.clusterEnvMap[c.id],
                      }
                  })
                : []
            clusters = clusters.concat({
                id: null,
                cluster_name: '',
                server_url: '',
                active: true,
                config: {},
                environments: [],
            })
            clusters = clusters.sort((a, b) => sortCallback('cluster_name', a, b))
            this.setState({ clusters: clusters })

            let cluster = this.state.clusters.find(
                (c) => c.agentInstallationStage === 1 || c.agentInstallationStage === 3,
            )
            if (!cluster) clearInterval(this.timerRef)
        } catch (error) {}
    }

    componentWillUnmount() {
        clearInterval(this.timerRef)
    }

    toggleCheckTlsConnection() {
        console.log(this.state.isTlsConnection)
        this.setState({ isTlsConnection: !this.state.isTlsConnection })
    }

    toggleShowAddCluster() {
        this.setState({ showAddCluster: !this.state.showAddCluster })
    }

    toggleKubeConfigFile() {
        this.setState({ isKubeConfigFile: !this.state.isKubeConfigFile })
    }

    toggleGetCluster() {
        this.setState({ getCluster: !this.state.getCluster })
    }

    toggleBrowseFile() {
        this.setState({ browseFile: !this.state.browseFile })
    }

    render() {
        if (this.state.view === ViewType.LOADING) return <Progressing pageLoader />
        else if (this.state.view === ViewType.ERROR) return <Reload className="dc__align-reload-center" />
        else {
            const moduleBasedTitle =
                'Clusters' + (this.props.serverMode === SERVER_MODE.EA_ONLY ? '' : ' and Environments')
            return (
                <section className="mt-16 mb-16 ml-20 mr-20 global-configuration__component flex-1">
                    <div className="flex left dc__content-space">
                        <h2 className="form__title">{moduleBasedTitle}</h2>
                        <button
                            type="button"
                            className="flex cta h-32 lh-n fcb-5"
                            onClick={() =>
                                this.setState({
                                    showAddCluster: true,
                                })
                            }
                        >
                            <Add className="icon-dim-24 fcb-5 dc__vertical-align-middle" />
                            Add cluster
                        </button>
                    </div>
                    <p className="form__subtitle">
                        Manage your organization’s {moduleBasedTitle.toLowerCase()}. &nbsp;
                        <a
                            className="dc__link"
                            href={DOCUMENTATION.GLOBAL_CONFIG_CLUSTER}
                            rel="noopener noreferer"
                            target="_blank"
                        >
                            Learn more
                        </a>
                    </p>

                    {this.state.clusters.map((cluster) => (
                        <Cluster
                            {...cluster}
                            reload={this.initialise}
                            key={cluster.id || Math.random().toString(36).substr(2, 5)}
                            serverMode={this.props.serverMode}
                        />
                    ))}
                    {this.state.showAddCluster && (
                        <Drawer position="right" width="1000px" onEscape={this.toggleShowAddCluster}>
                            <div className="h-100 bcn-0 pt-0 pb-12 pl-20">
                                <ClusterForm
                                    id={null}
                                    cluster_name
                                    server_url
                                    active={true}
                                    config={{}}
                                    toggleEditMode={() => {}}
                                    reload={true}
                                    prometheus_url=""
                                    prometheusAuth={this.state.prometheus}
                                    defaultClusterComponent={this.state.defaultClusterComponent}
                                    isGrafanaModuleInstalled={true}
                                    isTlsConnection={this.state.isTlsConnection}
                                    toggleCheckTlsConnection={this.toggleCheckTlsConnection}
                                    toggleShowAddCluster={this.toggleShowAddCluster}
                                    toggleKubeConfigFile={this.toggleKubeConfigFile}
                                    isKubeConfigFile={this.state.isKubeConfigFile}
                                    getCluster={this.state.getCluster}
                                    toggleGetCluster={this.toggleGetCluster}
                                    browseFile={this.state.browseFile}
                                    toggleBrowseFile={this.toggleBrowseFile}
                                />
                            </div>
                        </Drawer>
                    )}
                </section>
            )
        }
    }
}

function Cluster({
    id: clusterId,
    cluster_name,
    defaultClusterComponent,
    agentInstallationStage,
    server_url,
    active,
    config: defaultConfig,
    environments,
    reload,
    prometheus_url,
    serverMode,
    isTlsConnection,
    toggleCheckTlsConnection,
    toggleShowAddCluster,
    toggleKubeConfigFile,
    isKubeConfigFile,
    getCluster,
    toggleGetCluster,
    browseFile,
    toggleBrowseFile,
}) {
    const [editMode, toggleEditMode] = useState(false)
    const [environment, setEnvironment] = useState(null)
    const [config, setConfig] = useState(defaultConfig)
    const [prometheusAuth, setPrometheusAuth] = useState(undefined)
    const [showClusterComponentModal, toggleClusterComponentModal] = useState(false)
    const [, grafanaModuleStatus] = useAsync(() => getModuleInfo(ModuleNameMap.GRAFANA), [clusterId])
    const history = useHistory()
    const newEnvs = useMemo(() => {
        let namespacesInAll = true
        if (Array.isArray(environments)) {
            namespacesInAll = !environments.some((env) => !env.namespace)
        }
        return namespacesInAll && clusterId ? [{ id: null }].concat(environments || []) : environments || []
    }, [environments])

    function handleClose(isReload): void {
        setEnvironment(null)
        if (isReload) reload()
    }

    async function handleEdit(e) {
        try {
            const { result } = await getCluster(clusterId)
            setPrometheusAuth(result.prometheusAuth)
            setConfig({ ...result.config, ...(clusterId != 1 ? { bearer_token: DEFAULT_SECRET_PLACEHOLDER } : null) })
            toggleEditMode((t) => !t)
        } catch (err) {
            showError(err)
        }
    }

    function redirectToChartDeployment(appId, envId): void {
        history.push(`${URLS.APP}/${URLS.DEVTRON_CHARTS}/deployments/${appId}/env/${envId}`)
    }

    async function callRetryClusterInstall() {
        try {
            let payload = {}
            const { result } = await retryClusterInstall(clusterId, payload)
            if (result) toast.success('Successfully triggered')
            reload()
        } catch (error) {
            showError(error)
        }
    }

    async function clusterInstallStatusOnclick(e) {
        if (agentInstallationStage === 3) {
            callRetryClusterInstall()
        } else toggleClusterComponentModal(!showClusterComponentModal)
    }

    let envName: string = getEnvName(defaultClusterComponent, agentInstallationStage)

    return (
        <>
            <article
                className={`cluster-list ${
                    clusterId ? 'cluster-list--update' : 'cluster-list--create collapsed-list collapsed-list--create'
                }`}
            >
                {!editMode ? (
                    <>
                        {/* <List key={clusterId} onClick={clusterId ? () => {} : (e) => toggleEditMode((t) => !t)}>
                            {!clusterId && (
                                <List.Logo>
                                    <Add className="icon-dim-24 fcb-5 dc__vertical-align-middle" />
                                </List.Logo>
                            )}
                            <div className="flex left">
                                {clusterId ? (
                                    <ClusterIcon className="cluster-icon icon-dim-24 dc__vertical-align-middle mr-16" />
                                ) : null}
                                <List.Title
                                    title={cluster_name || 'Add cluster'}
                                    subtitle={server_url}
                                    className="fw-6"
                                />
                            </div>
                            {clusterId && <List.DropDown src={<Pencil color="#b1b7bc" onClick={handleEdit} />} />}
                        </List> */}
                        {serverMode !== SERVER_MODE.EA_ONLY && clusterId ? <hr className="mt-0 mb-0" /> : null}
                        {serverMode !== SERVER_MODE.EA_ONLY && clusterId ? (
                            <ClusterInstallStatus
                                agentInstallationStage={agentInstallationStage}
                                envName={envName}
                                onClick={clusterInstallStatusOnclick}
                            />
                        ) : null}
                        {showClusterComponentModal ? (
                            <ClusterComponentModal
                                agentInstallationStage={agentInstallationStage}
                                components={defaultClusterComponent}
                                environmentName={envName}
                                callRetryClusterInstall={callRetryClusterInstall}
                                redirectToChartDeployment={redirectToChartDeployment}
                                close={(e) => {
                                    toggleClusterComponentModal(!showClusterComponentModal)
                                }}
                            />
                        ) : null}
                        {serverMode !== SERVER_MODE.EA_ONLY && Array.isArray(newEnvs) && newEnvs.length > 0 && (
                            <div className="environments-container">
                                {newEnvs.map(
                                    ({
                                        id,
                                        environment_name,
                                        cluster_id,
                                        cluster_name,
                                        active,
                                        prometheus_url,
                                        namespace,
                                        default: isProduction,
                                    }) => (
                                        <List
                                            onClick={(e) =>
                                                setEnvironment({
                                                    id,
                                                    environment_name,
                                                    cluster_id: clusterId,
                                                    namespace,
                                                    prometheus_url,
                                                    isProduction,
                                                })
                                            }
                                            key={id}
                                            className={`cluster-environment cluster-environment--${
                                                id ? 'update' : 'create collapsed-list collapsed-list--create'
                                            }`}
                                        >
                                            <List.Logo>
                                                {id ? (
                                                    <Database className="icon-dim-24" />
                                                ) : (
                                                    <Add className="icon-dim-24 fcb-5" />
                                                )}
                                            </List.Logo>
                                            <div className="flex left">
                                                <List.Title
                                                    title={environment_name || 'Add environment'}
                                                    subtitle={id ? `namespace: ${namespace}` : ''}
                                                    tag={isProduction ? 'PROD' : null}
                                                />
                                            </div>
                                        </List>
                                    ),
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <ClusterForm
                            {...{
                                id: clusterId,
                                cluster_name,
                                server_url,
                                active,
                                config,
                                toggleEditMode,
                                reload,
                                prometheus_url,
                                isTlsConnection,
                                toggleCheckTlsConnection,
                                prometheusAuth,
                                defaultClusterComponent,
                                toggleShowAddCluster,
                                toggleKubeConfigFile,
                                isKubeConfigFile,
                                getCluster,
                                toggleGetCluster,
                                browseFile,
                                toggleBrowseFile,
                                isGrafanaModuleInstalled:
                                    grafanaModuleStatus?.result?.status === ModuleStatus.INSTALLED,
                            }}
                        />
                    </>
                )}
            </article>
            {environment && (
                <Environment
                    reload={reload}
                    cluster_name={cluster_name}
                    {...environment}
                    handleClose={handleClose}
                    isNamespaceMandatory={Array.isArray(environments) && environments.length > 0}
                />
            )}
        </>
    )
}

function ClusterForm({
    id,
    cluster_name,
    server_url,
    active,
    config,
    toggleEditMode,
    reload,
    prometheus_url,
    prometheusAuth,
    defaultClusterComponent,
    isGrafanaModuleInstalled,
    isTlsConnection,
    toggleCheckTlsConnection,
    toggleShowAddCluster,
    toggleKubeConfigFile,
    isKubeConfigFile,
    toggleGetCluster,
    getCluster,
    browseFile,
    toggleBrowseFile,
}) {
    const [loading, setLoading] = useState(false)
    const [prometheusToggleEnabled, setPrometheusToggleEnabled] = useState(prometheus_url ? true : false)
    const [prometheusAuthenticationType, setPrometheusAuthenticationType] = useState({
        type: prometheusAuth && prometheusAuth.userName ? AuthenticationType.BASIC : AuthenticationType.ANONYMOUS,
    })
    let authenTicationType =
        prometheusAuth && prometheusAuth.userName ? AuthenticationType.BASIC : AuthenticationType.ANONYMOUS

    const isDefaultCluster = (): boolean => {
        return id == 1
    }
    const [deleting, setDeleting] = useState(false)
    const [confirmation, toggleConfirmation] = useState(false)
    const inputFileRef = useRef(null)
    const [uploadState, setUploadState] = useState<string>(UPLOAD_STATE.UPLOAD)
    const [loadingData, setLoadingData] = useState(false)

    const { state, disable, handleOnChange, handleOnSubmit } = useForm(
        {
            cluster_name: { value: cluster_name, error: '' },
            url: { value: server_url, error: '' },
            userName: { value: prometheusAuth?.userName, error: '' },
            password: { value: prometheusAuth?.password, error: '' },
            tlsClientKey: { value: prometheusAuth?.tlsClientKey, error: '' },
            tlsClientCert: { value: prometheusAuth?.tlsClientCert, error: '' },
            token: { value: config && config.bearer_token ? config.bearer_token : '', error: '' },
            endpoint: { value: prometheus_url || '', error: '' },
            authType: { value: authenTicationType, error: '' },
        },
        {
            cluster_name: {
                required: true,
                validators: [
                    { error: 'Name is required', regex: /^.*$/ },
                    { error: "Use only lowercase alphanumeric characters, '-', '_' or '.'", regex: /^[a-z0-9-\.\_]+$/ },
                    { error: "Cannot start/end with '-', '_' or '.'", regex: /^(?![-._]).*[^-._]$/ },
                    { error: 'Minimum 3 and Maximum 63 characters required', regex: /^.{3,63}$/ },
                ],
            },
            url: {
                required: true,
                validator: { error: 'URL is required', regex: /^.*$/ },
            },
            authType: {
                required: false,
                validator: { error: 'Authentication Type is required', regex: /^(?!\s*$).+/ },
            },
            userName: {
                required:
                    prometheusToggleEnabled && prometheusAuthenticationType.type === AuthenticationType.BASIC
                        ? true
                        : false,
                validator: { error: 'username is required', regex: /^(?!\s*$).+/ },
            },
            password: {
                required:
                    prometheusToggleEnabled && prometheusAuthenticationType.type === AuthenticationType.BASIC
                        ? true
                        : false,
                validator: { error: 'password is required', regex: /^(?!\s*$).+/ },
            },
            tlsClientKey: {
                required: false,
                validator: { error: 'TLS Key is required', regex: /^(?!\s*$).+/ },
            },
            tlsClientCert: {
                required: false,
                validator: { error: 'TLS Certificate is required', regex: /^(?!\s*$).+/ },
            },
            token:
                isDefaultCluster() || id
                    ? {}
                    : {
                          required: true,
                          validator: { error: 'token is required', regex: /[^]+/ },
                      },
            endpoint: {
                required: prometheusToggleEnabled ? true : false,
                validator: { error: 'endpoint is required', regex: /^.*$/ },
            },
        },
        onValidation,
    )

    const handleOnFocus = (e): void => {
        if (e.target.value === DEFAULT_SECRET_PLACEHOLDER) {
            e.target.value = ''
        }
    }

    const handleOnBlur = (e): void => {
        if (id && id != 1 && !e.target.value) {
            e.target.value = DEFAULT_SECRET_PLACEHOLDER
        }
    }

    const getClusterPayload = () => {
        return {
            id,
            cluster_name: state.cluster_name.value,
            config: {
                bearer_token:
                    state.token.value && state.token.value !== DEFAULT_SECRET_PLACEHOLDER ? state.token.value : '',
            },
            active,
            prometheus_url: prometheusToggleEnabled ? state.endpoint.value : '',
            prometheusAuth: {
                userName: prometheusToggleEnabled ? state.userName.value : '',
                password: prometheusToggleEnabled ? state.password.value : '',
            },
        }
    }

    async function onValidation() {
        let payload = getClusterPayload()
        const urlValue = state.url.value.trim()
        if (urlValue.endsWith('/')) {
            payload['server_url'] = urlValue.slice(0, -1)
        } else {
            payload['server_url'] = urlValue
        }

        if (state.authType.value === AuthenticationType.BASIC && prometheusToggleEnabled) {
            let isValid = state.userName?.value && state.password?.value
            if (!isValid) {
                toast.error('Please add both username and password')
                return
            } else {
                payload.prometheusAuth['userName'] = state.userName.value || ''
                payload.prometheusAuth['password'] = state.password.value || ''
            }
        }
        if ((state.tlsClientKey.value || state.tlsClientCert.value) && prometheusToggleEnabled) {
            let isValid = state.tlsClientKey.value?.length && state.tlsClientCert.value?.length
            if (!isValid) {
                toast.error('Please add both TLS Key and Certificate')
                return
            } else {
                payload.prometheusAuth['tlsClientKey'] = state.tlsClientKey.value || ''
                payload.prometheusAuth['tlsClientCert'] = state.tlsClientCert.value || ''
            }
        }
        const api = id ? updateCluster : saveCluster
        try {
            setLoading(true)
            const { result } = await api(payload)
            toast.success(`Successfully ${id ? 'updated' : 'saved'}.`)
            reload()
            toggleEditMode((e) => !e)
        } catch (err) {
            showError(err)
        } finally {
            setLoading(false)
        }
    }

    const setPrometheusToggle = () => {
        setPrometheusToggleEnabled(!prometheusToggleEnabled)
    }

    const OnPrometheusAuthTypeChange = (e) => {
        handleOnChange(e)
        if (state.authType.value == AuthenticationType.BASIC) {
            setPrometheusAuthenticationType({ type: AuthenticationType.ANONYMOUS })
        } else {
            setPrometheusAuthenticationType({ type: AuthenticationType.BASIC })
        }
    }

    let payload = {
        id,
        cluster_name,
        config: { bearer_token: state.token.value },
        active,
        prometheus_url: prometheusToggleEnabled ? state.endpoint.value : '',
        prometheusAuth: {
            userName: prometheusToggleEnabled ? state.userName.value : '',
            password: prometheusToggleEnabled ? state.password.value : '',
        },
        server_url,

        defaultClusterComponent: defaultClusterComponent,
        k8sversion: '',
    }

    const ClusterInfoComponent = () => {
        const k8sClusters = Object.values(CLUSTER_COMMAND)
        return (
            <>
                {k8sClusters.map((cluster, key) => (
                    <>
                        <TippyHeadless
                            className=""
                            theme="light"
                            placement="bottom"
                            trigger="click"
                            interactive={true}
                            render={() => (
                                <ClusterInfoStepsModal
                                    subTitle={cluster.title}
                                    command={cluster.command}
                                    clusterName={cluster.clusterName}
                                />
                            )}
                            maxWidth="468px"
                        >
                            <span className="ml-4 mr-2 cb-5 cursor">{cluster.heading}</span>
                        </TippyHeadless>
                        {key !== k8sClusters.length - 1 && <span className="cn-2">|</span>}
                    </>
                ))}
            </>
        )
    }

    const clusterLabel = () => {
        return (
            <div className="flex left ">
                Server URL & Bearer token{isDefaultCluster() ? '' : '*'}
                <span className="icon-dim-16 fcn-9 mr-4 ml-16">
                    <Question className="icon-dim-16" />
                </span>
                <span>How to find for </span>
                <ClusterInfoComponent />
            </div>
        )
    }

    const onFileChange = (e): void => {
        setUploadState(UPLOAD_STATE.UPLOADING)
        let formData = new FormData()
        formData.append('file', e.target.files[0])
        validateChart(formData)
            .then((response: ChartUploadResponse) => {
                setUploadState(UPLOAD_STATE.SUCCESS)
            })
            .catch((error) => {
                setUploadState(UPLOAD_STATE.ERROR)
            })
    }

    const handleSuccessButton = (): void => {
        if (uploadState === UPLOAD_STATE.SUCCESS) {
            onCancelUpload('Save')
        } else if (uploadState === UPLOAD_STATE.UPLOAD) {
            inputFileRef.current.value = null
            inputFileRef.current.click()
        }
    }

    const onCancelUpload = (actionType: string): void => {
        if (actionType === 'Save') {
            setLoadingData(true)
        } else {
            setLoadingData(false)
        }
    }

    return getCluster ? (
        <EmptyState>
            <EmptyState.Image>
                <MechanicalOperation />
            </EmptyState.Image>
            <EmptyState.Title>
                <h4>Connecting to Cluster</h4>
            </EmptyState.Title>
            <EmptyState.Subtitle>
                Please wait while the kubeconfig is verified and cluster details are fetched.
            </EmptyState.Subtitle>
        </EmptyState>
    ) : (
        <>
            <form action="" className="cluster-form" style={{ padding: 'auto 0' }} onSubmit={handleOnSubmit}>
                <div className="flex flex-align-center dc__border-bottom flex-justify bcn-0 pb-12 mb-20">
                    <h2 className="fs-16 fw-6 lh-1-43 m-0 title-padding">Add Cluster</h2>
                    <button type="button" className="dc__transparent flex icon-dim-24" onClick={toggleShowAddCluster}>
                        <Close className="icon-dim-24" />
                    </button>
                </div>
                <div style={{ overflow: 'auto', height: 'calc(100vh - 120px)' }}>
                    <div className="form__row clone-apps dc__inline-block pt-0 pr-20 pb-12 pl-20">
                        <RadioGroup
                            className="radio-group-no-border"
                            value={isKubeConfigFile ? 'EXISTING' : 'BLANK'}
                            name="trigger-type"
                            onChange={toggleKubeConfigFile}
                        >
                            <RadioGroupItem value={AppCreationType.Blank}>Use Server URL & Bearer token</RadioGroupItem>
                            <RadioGroupItem value={AppCreationType.Existing}>From kubeconfig</RadioGroupItem>
                        </RadioGroup>
                    </div>

                    {isKubeConfigFile && (
                        <>
                            <hr />
                            <div className="code-editor-container">
                                <CodeEditor
                                    value={''}
                                    height={650}
                                    diffView={false}
                                    readOnly={false}
                                    mode={MODES.YAML}
                                    noParsing
                                >
                                    <CodeEditor.Header>
                                        <div className="user-list__subtitle flex-right">
                                            Paste the contents of kubeconfig file here
                                            <div className="dc__link">
                                                {uploadState !== UPLOAD_STATE.UPLOAD && (
                                                    <button
                                                        className={` dc__no-text-transform ${
                                                            uploadState === UPLOAD_STATE.UPLOADING
                                                                ? '  mr-20'
                                                                : '  ml-20'
                                                        }`}
                                                        onClick={(e) => onCancelUpload('Cancel')}
                                                    >
                                                        Cancel upload
                                                    </button>
                                                )}
                                                {uploadState !== UPLOAD_STATE.UPLOADING && (
                                                    <div onClick={handleSuccessButton}>
                                                        {uploadState === UPLOAD_STATE.UPLOAD
                                                            ? 'Browse file...'
                                                            : uploadState === UPLOAD_STATE.ERROR
                                                            ? 'Upload another chart'
                                                            : 'Save'}
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                ref={inputFileRef}
                                                onChange={onFileChange}
                                                accept=".yaml"
                                                style={{ display: 'none' }}
                                            />
                                        </div>
                                        <CodeEditor.ValidationError />
                                    </CodeEditor.Header>
                                </CodeEditor>
                            </div>

                            <div className="w-900 dc__border-top flex right pt-16 pr-0 pb-16 pl-20 dc__position-fixed dc__bottom-0">
                                <button className="cta cancel" type="button" onClick={toggleShowAddCluster}>
                                    Cancel
                                </button>
                                <button
                                    className="cta"
                                    type="button"
                                    onClick={toggleGetCluster}
                                    disabled={uploadState !== UPLOAD_STATE.SUCCESS ? false : true}
                                >
                                    Get cluster
                                </button>
                            </div>
                        </>
                    )}

                    <div className="form__row">
                        <CustomInput
                            labelClassName="dc__required-field"
                            autoComplete="off"
                            name="cluster_name"
                            disabled={isDefaultCluster()}
                            value={state.cluster_name.value}
                            error={state.cluster_name.error}
                            onChange={handleOnChange}
                            label="Cluster Name"
                            placeholder="Cluster Name"
                        />
                    </div>
                    <div className="form__row mb-8-imp">
                        <CustomInput
                            autoComplete="off"
                            name="url"
                            value={state.url.value}
                            error={state.url.error}
                            onChange={handleOnChange}
                            label={clusterLabel()}
                            placeholder="Enter server URL"
                        />
                    </div>
                    <div className="form__row form__row--bearer-token flex column left top">
                        <div className="bearer-token">
                            <ResizableTextarea
                                className="dc__resizable-textarea__with-max-height dc__required-field"
                                name="token"
                                value={config && config.bearer_token ? config.bearer_token : ''}
                                onChange={handleOnChange}
                                onBlur={handleOnBlur}
                                onFocus={handleOnFocus}
                                placeholder="Enter bearer token"
                            />
                        </div>
                        {state.token.error && (
                            <label htmlFor="" className="form__error">
                                <FormError className="form__icon form__icon--error" />
                                {state.token.error}
                            </label>
                        )}
                    </div>
                    {isGrafanaModuleInstalled && (
                        <>
                            <hr />
                            <div className="dc__position-rel flex left cursor dc__hover-n50 mb-20">
                                <Checkbox
                                    isChecked={isTlsConnection}
                                    rootClassName="form__checkbox-label--ignore-cache mb-0"
                                    value={'CHECKED'}
                                    onChange={toggleCheckTlsConnection}
                                >
                                    <div className="mr-4 flex center"> Use secure TLS connection {isTlsConnection}</div>
                                </Checkbox>
                            </div>

                            {isTlsConnection && (
                                <>
                                    <div className="form__row">
                                        <span className="form__label dc__required-field">
                                            Certificate Authority Data
                                        </span>
                                        <ResizableTextarea
                                            className="dc__resizable-textarea__with-max-height w-100"
                                            name="tlsClientCert"
                                            value={state.tlsClientCert.value}
                                            onChange={handleOnChange}
                                            placeholder={'Enter CA Data'}
                                        />
                                    </div>
                                    <div className="form__row">
                                        <span className="form__label dc__required-field">TLS Key</span>
                                        <ResizableTextarea
                                            className="dc__resizable-textarea__with-max-height w-100"
                                            name="tlsClientKey"
                                            value={state.tlsClientKey.value}
                                            onChange={handleOnChange}
                                            placeholder={'Enter tls Key'}
                                        />
                                    </div>
                                    <div className="form__row">
                                        <span className="form__label dc__required-field">TLS Certificate</span>
                                        <ResizableTextarea
                                            className="dc__resizable-textarea__with-max-height w-100"
                                            name="tlsClientCert"
                                            value={state.tlsClientCert.value}
                                            onChange={handleOnChange}
                                            placeholder={'Enter tls Certificate'}
                                        />
                                    </div>
                                </>
                            )}
                            <hr />
                            <div
                                className={`${
                                    prometheusToggleEnabled ? 'mb-20' : prometheus_url ? 'mb-20' : 'mb-40'
                                } mt-20`}
                            >
                                <div className="dc__content-space flex">
                                    <span className="form__input-header">
                                        See metrics for applications in this cluster
                                    </span>
                                    <div className="" style={{ width: '32px', height: '20px' }}>
                                        <Toggle selected={prometheusToggleEnabled} onSelect={setPrometheusToggle} />
                                    </div>
                                </div>
                                <span className="cn-6 fs-12">
                                    Configure prometheus to see metrics like CPU, RAM, Throughput etc. for applications
                                    running in this cluster
                                </span>
                            </div>
                        </>
                    )}
                    {isGrafanaModuleInstalled && !prometheusToggleEnabled && prometheus_url && (
                        <PrometheusWarningInfo />
                    )}
                    {isGrafanaModuleInstalled && prometheusToggleEnabled && (
                        <div className="">
                            {(state.userName.error || state.password.error || state.endpoint.error) && (
                                <PrometheusRequiredFieldInfo />
                            )}
                            <div className="form__row">
                                <CustomInput
                                    labelClassName="dc__required-field"
                                    autoComplete="off"
                                    name="endpoint"
                                    value={state.endpoint.value}
                                    error={state.endpoint.error}
                                    onChange={handleOnChange}
                                    label="Prometheus endpoint"
                                />
                            </div>
                            <div className="form__row">
                                <span className="form__label">Authentication Type*</span>
                                <RadioGroup
                                    value={state.authType.value}
                                    name={`authType`}
                                    onChange={(e) => OnPrometheusAuthTypeChange(e)}
                                >
                                    <RadioGroupItem value={AuthenticationType.BASIC}> Basic </RadioGroupItem>
                                    <RadioGroupItem value={AuthenticationType.ANONYMOUS}> Anonymous </RadioGroupItem>
                                </RadioGroup>
                            </div>
                            {state.authType.value === AuthenticationType.BASIC ? (
                                <div className="form__row form__row--flex">
                                    <div className="w-50 mr-8 ">
                                        <CustomInput
                                            name="userName"
                                            value={state.userName.value}
                                            error={state.userName.error}
                                            onChange={handleOnChange}
                                            label="Username"
                                        />
                                    </div>
                                    <div className="w-50 ml-8">
                                        <CustomPassword
                                            name="password"
                                            value={state.password.value}
                                            error={state.userName.error}
                                            onChange={handleOnChange}
                                            label="Password"
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                    <div className={`form__buttons`}>
                        {id && (
                            <button
                                style={{ margin: 'auto', marginLeft: 0 }}
                                className="cta delete"
                                type="button"
                                onClick={() => toggleConfirmation(true)}
                            >
                                {deleting ? <Progressing /> : 'Delete'}
                            </button>
                        )}
                    </div>
                </div>

                {!isKubeConfigFile && (
                    <div className="w-900 dc__border-top flex right pt-16 pr-0 pb-16 pl-20 dc__position-fixed dc__bottom-0">
                        <button className="cta cancel" type="button" onClick={toggleShowAddCluster}>
                            Cancel
                        </button>
                        <button className="cta">{loading ? <Progressing /> : 'Save cluster'}</button>
                    </div>
                )}

                {confirmation && (
                    <DeleteComponent
                        setDeleting={setDeleting}
                        deleteComponent={deleteCluster}
                        payload={payload}
                        title={cluster_name}
                        toggleConfirmation={toggleConfirmation}
                        component={DeleteComponentsName.Cluster}
                        confirmationDialogDescription={DC_CLUSTER_CONFIRMATION_MESSAGE}
                        reload={reload}
                    />
                )}
            </form>
        </>
    )
}

function Environment({
    cluster_name,
    environment_name,
    namespace,
    id,
    cluster_id,
    handleClose,
    prometheus_endpoint,
    isProduction,
    isNamespaceMandatory = true,
    reload,
}) {
    const [loading, setLoading] = useState(false)
    const [ignore, setIngore] = useState(false)
    const [ignoreError, setIngoreError] = useState('')
    const { state, disable, handleOnChange, handleOnSubmit } = useForm(
        {
            environment_name: { value: environment_name, error: '' },
            namespace: { value: namespace, error: '' },
            isProduction: { value: isProduction ? 'true' : 'false', error: '' },
        },
        {
            environment_name: {
                required: true,
                validators: [
                    { error: 'Environment name is required', regex: /^.*$/ },
                    { error: "Use only lowercase alphanumeric characters or '-'", regex: /^[a-z0-9-]+$/ },
                    { error: "Cannot start/end with '-'", regex: /^(?![-]).*[^-]$/ },
                    { error: 'Minimum 1 and Maximum 16 characters required', regex: /^.{1,16}$/ },
                ],
            },
            namespace: {
                required: isNamespaceMandatory,
                validators: [
                    { error: 'Namespace is required', regex: /^.*$/ },
                    { error: "Use only lowercase alphanumeric characters or '-'", regex: /^[a-z0-9-]+$/ },
                    { error: "Cannot start/end with '-'", regex: /^(?![-]).*[^-]$/ },
                    { error: 'Maximum 63 characters required', regex: /^.{1,63}$/ },
                ],
            },
            isProduction: {
                required: true,
                validator: { error: 'token is required', regex: /[^]+/ },
            },
        },
        onValidation,
    )
    const [deleting, setDeleting] = useState(false)
    const [confirmation, toggleConfirmation] = useState(false)

    const getEnvironmentPayload = () => {
        return {
            id,
            environment_name: state.environment_name.value,
            cluster_id,
            prometheus_endpoint,
            namespace: state.namespace.value || '',
            active: true,
            default: state.isProduction.value === 'true',
        }
    }
    async function onValidation() {
        if (!state.namespace.value && !ignore) {
            setIngoreError('Enter a namespace or select ignore namespace')
            return
        }
        let payload = getEnvironmentPayload()

        const api = id ? updateEnvironment : saveEnvironment
        try {
            setLoading(true)
            await api(payload, id)
            toast.success(`Successfully ${id ? 'updated' : 'saved'}`)
            handleClose(true)
        } catch (err) {
            showError(err)
        } finally {
            setLoading(false)
        }
    }

    const clusterDelete = (): void => {
        setDeleting(true)
        handleClose(false)
    }

    return (
        <VisibleModal className="environment-create-modal" close={handleClose}>
            <form className="environment-create-body" onClick={(e) => e.stopPropagation()} onSubmit={handleOnSubmit}>
                <div className="form__row">
                    <div className="flex left">
                        <div className="form__title">{id ? 'Update Environment' : 'New Environment'}</div>
                        <Close className="icon-dim-24 dc__align-right cursor" onClick={(e) => handleClose(false)} />
                    </div>
                </div>
                <div className="form__row">
                    <CustomInput
                        autoComplete="off"
                        disabled={!!environment_name}
                        name="environment_name"
                        value={state.environment_name.value}
                        error={state.environment_name.error}
                        onChange={handleOnChange}
                        label="Environment Name*"
                    />
                </div>
                <div className="form__row form__row--namespace">
                    <CustomInput
                        disabled={!!namespace || ignore}
                        name="namespace"
                        value={state.namespace.value}
                        error={state.namespace.error}
                        onChange={handleOnChange}
                        label={`Enter Namespace ${isNamespaceMandatory ? '*' : ''}`}
                    />
                </div>
                {!isNamespaceMandatory && (
                    <>
                        <div className="form__row form__row--ignore-namespace">
                            <input
                                type="checkbox"
                                onChange={(e) => {
                                    setIngore((t) => !t)
                                    setIngoreError('')
                                }}
                                checked={ignore}
                            />
                            <div className="form__label dc__bold">Ignore namespace</div>
                        </div>
                        <div className="form__row form__row--warn">
                            If left empty, you won't be able to add more environments to this cluster
                        </div>
                        {ignoreError && <div className="form__row form__error">{ignoreError}</div>}
                    </>
                )}
                <div className="form__row">
                    <div className="form__label">Environment type*</div>
                    <div className="environment-type pointer">
                        <div className="flex left environment environment--production">
                            <label className="form__label">
                                <input
                                    type="radio"
                                    name="isProduction"
                                    checked={state.isProduction.value === 'true'}
                                    value="true"
                                    onChange={handleOnChange}
                                />
                                <span>Production</span>
                            </label>
                        </div>
                        <div className="flex left environment environment--non-production">
                            <label className="form__label">
                                <input
                                    type="radio"
                                    name="isProduction"
                                    checked={state.isProduction.value === 'false'}
                                    value="false"
                                    onChange={handleOnChange}
                                />
                                <span>Non - Production</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className={`form__buttons`}>
                    {id && (
                        <button
                            className="cta delete dc__m-auto ml-0"
                            type="button"
                            onClick={() => toggleConfirmation(true)}
                        >
                            {deleting ? <Progressing /> : 'Delete'}
                        </button>
                    )}
                    <button className="cta" type="submit" disabled={loading}>
                        {loading ? <Progressing /> : id ? 'Update' : 'Save'}
                    </button>
                </div>
                {confirmation && (
                    <DeleteComponent
                        setDeleting={clusterDelete}
                        deleteComponent={deleteEnvironment}
                        payload={getEnvironmentPayload()}
                        title={state.environment_name.value}
                        toggleConfirmation={toggleConfirmation}
                        component={DeleteComponentsName.Environment}
                        confirmationDialogDescription={DC_ENVIRONMENT_CONFIRMATION_MESSAGE}
                        reload={reload}
                    />
                )}
            </form>
        </VisibleModal>
    )
}

import React from 'react';
import { useIconSet } from './IconProvider';

// Default Icons
import DefaultBookmarkIcon from './icons/BookmarkIcon';
import DefaultBrainCircuitIcon from './icons/BrainCircuitIcon';
import DefaultCheckIcon from './icons/CheckIcon';
import DefaultChevronDownIcon from './icons/ChevronDownIcon';
import DefaultChevronRightIcon from './icons/ChevronRightIcon';
import DefaultChevronUpIcon from './icons/ChevronUpIcon';
import DefaultClipboardIcon from './icons/ClipboardIcon';
import DefaultCodeIcon from './icons/CodeIcon';
import DefaultCpuIcon from './icons/CpuIcon';
import DefaultDownloadCloudIcon from './icons/DownloadCloudIcon';
import DefaultFileIcon from './icons/FileIcon';
import DefaultFileCodeIcon from './icons/FileCodeIcon';
import DefaultFilePlusIcon from './icons/FilePlusIcon';
import DefaultFileTextIcon from './icons/FileTextIcon';
import DefaultFolderIcon from './icons/FolderIcon';
import DefaultFolderOpenIcon from './icons/FolderOpenIcon';
import DefaultGlobeIcon from './icons/GlobeIcon';
import DefaultGpuIcon from './icons/GpuIcon';
import DefaultHammerIcon from './icons/HammerIcon';
import DefaultIdentityIcon from './icons/IdentityIcon';
import DefaultInfoIcon from './icons/InfoIcon';
import DefaultLightbulbIcon from './icons/LightbulbIcon';
import DefaultMessagePlusIcon from './icons/MessagePlusIcon';
import DefaultMessageSquareIcon from './icons/MessageSquareIcon';
import DefaultModelIcon from './icons/ModelIcon';
import DefaultMoonIcon from './icons/MoonIcon';
import DefaultPaletteIcon from './icons/PaletteIcon';
import DefaultPaperclipIcon from './icons/PaperclipIcon';
import DefaultPlayIcon from './icons/PlayIcon';
import DefaultPlusIcon from './icons/PlusIcon';
import DefaultRamIcon from './icons/RamIcon';
import DefaultSearchIcon from './icons/SearchIcon';
import DefaultSendIcon from './icons/SendIcon';
import DefaultServerIcon from './icons/ServerIcon';
import DefaultSettingsIcon from './icons/SettingsIcon';
import DefaultSlidersIcon from './icons/SlidersIcon';
import DefaultSparklesIcon from './icons/SparklesIcon';
import DefaultSpinnerIcon from './icons/SpinnerIcon';
import DefaultStopIcon from './icons/StopIcon';
import DefaultSunIcon from './icons/SunIcon';
import DefaultTerminalIcon from './icons/TerminalIcon';
import DefaultTrashIcon from './icons/TrashIcon';
import DefaultXIcon from './icons/XIcon';
import DefaultXCircleIcon from './icons/XCircleIcon';

// Lucide Icons
import {
    Bookmark as LucideBookmark,
    BrainCircuit as LucideBrainCircuit,
    Check as LucideCheck,
    ChevronDown as LucideChevronDown,
    ChevronRight as LucideChevronRight,
    ChevronUp as LucideChevronUp,
    Clipboard as LucideClipboard,
    Code as LucideCode,
    Cpu as LucideCpu,
    DownloadCloud as LucideDownloadCloud,
    File as LucideFile,
    FileCode as LucideFileCode,
    FilePlus as LucideFilePlus,
    FileText as LucideFileText,
    Folder as LucideFolder,
    FolderOpen as LucideFolderOpen,
    Globe as LucideGlobe,
    HardDrive as LucideGpu,
    Hammer as LucideHammer,
    UserCog as LucideIdentity,
    Info as LucideInfo,
    Lightbulb as LucideLightbulb,
    MessageSquarePlus as LucideMessagePlus,
    MessageSquare as LucideMessageSquare,
    Box as LucideModel,
    Moon as LucideMoon,
    Palette as LucidePalette,
    Paperclip as LucidePaperclip,
    Play as LucidePlay,
    Plus as LucidePlus,
    MemoryStick as LucideRam,
    Search as LucideSearch,
    Send as LucideSend,
    Server as LucideServer,
    Settings as LucideSettings,
    SlidersHorizontal as LucideSliders,
    Sparkles as LucideSparkles,
    LoaderCircle as LucideLoaderCircle,
    Square as LucideStop,
    Sun as LucideSun,
    Terminal as LucideTerminal,
    Trash2 as LucideTrash,
    X as LucideX,
    XCircle as LucideXCircle,
} from 'lucide-react';

// Heroicons
import {
    BookmarkIcon as HeroBookmark,
    CpuChipIcon as HeroBrainCircuit,
    CheckIcon as HeroCheck,
    ChevronDownIcon as HeroChevronDown,
    ChevronRightIcon as HeroChevronRight,
    ChevronUpIcon as HeroChevronUp,
    ClipboardIcon as HeroClipboard,
    CodeBracketIcon as HeroCode,
    CpuChipIcon as HeroCpu,
    ArrowDownTrayIcon as HeroDownloadCloud,
    DocumentIcon as HeroFile,
    CodeBracketSquareIcon as HeroFileCode,
    DocumentPlusIcon as HeroFilePlus,
    DocumentTextIcon as HeroFileText,
    FolderIcon as HeroFolder,
    FolderOpenIcon as HeroFolderOpen,
    GlobeAltIcon as HeroGlobe,
    ComputerDesktopIcon as HeroGpu,
    WrenchScrewdriverIcon as HeroHammer,
    UserCircleIcon as HeroIdentity,
    InformationCircleIcon as HeroInfo,
    LightBulbIcon as HeroLightbulb,
    ChatBubbleLeftRightIcon as HeroMessagePlus,
    ChatBubbleLeftIcon as HeroMessageSquare,
    CubeIcon as HeroModel,
    MoonIcon as HeroMoon,
    PaintBrushIcon as HeroPalette,
    PaperClipIcon as HeroPaperclip,
    PlayIcon as HeroPlay,
    PlusIcon as HeroPlus,
    ComputerDesktopIcon as HeroRam,
    MagnifyingGlassIcon as HeroSearch,
    PaperAirplaneIcon as HeroSend,
    ServerIcon as HeroServer,
    Cog6ToothIcon as HeroSettings,
    AdjustmentsHorizontalIcon as HeroSliders,
    SparklesIcon as HeroSparkles,
    ArrowPathIcon as HeroArrowPath,
    StopIcon as HeroStop,
    SunIcon as HeroSun,
    CommandLineIcon as HeroTerminal,
    TrashIcon as HeroTrash,
    XMarkIcon as HeroX,
    XCircleIcon as HeroXCircle,
} from '@heroicons/react/24/outline';

// Feather Icons
import * as Feather from 'react-feather';

// Font Awesome
import {
    FaBookmark, FaBrain, FaCheck, FaChevronDown, FaChevronRight, FaChevronUp, FaClipboard, FaCode, FaMicrochip, FaCloudDownloadAlt as FaDownloadCloud, FaFile, FaFileCode, FaFileMedical, FaFileAlt, FaFolder, FaFolderOpen, FaGlobe, FaServer as FaServerIcon, FaHammer, FaUserCog, FaInfoCircle, FaLightbulb, FaCommentMedical, FaComment, FaCube, FaMoon, FaPalette, FaPaperclip, FaPlay, FaPlus, FaMemory, FaSearch, FaPaperPlane, FaCog, FaSlidersH, FaMagic, FaSpinner, FaStop, FaSun, FaTerminal, FaTrash, FaTimes, FaTimesCircle
} from 'react-icons/fa';

// Material Design
import {
    MdBookmark, MdPsychology, MdCheck, MdExpandMore, MdChevronRight, MdExpandLess as MdChevronUp, MdContentPaste, MdCode, MdDeveloperBoard, MdCloudDownload as MdDownloadCloud, MdInsertDriveFile, MdSource, MdNoteAdd, MdDescription, MdFolder, MdFolderOpen, MdPublic, MdDns, MdBuild, MdAccountBox, MdInfo, MdLightbulb, MdAddComment, MdChat, MdViewInAr, MdBrightness2, MdPalette, MdAttachFile, MdPlayArrow, MdAdd, MdMemory, MdSearch, MdSend, MdSettings, MdTune, MdAutoAwesome, MdCached, MdStop, MdWbSunny, MdTerminal, MdDelete, MdClose, MdCancel
} from 'react-icons/md';


const AnimatedSpinner: React.FC<{ IconComponent: React.ElementType, className?: string }> = ({ IconComponent, className, ...rest }) => (
    <IconComponent {...rest} className={`${className} animate-spin`} />
);

const iconMap = {
    default: {
        bookmark: DefaultBookmarkIcon,
        brainCircuit: DefaultBrainCircuitIcon,
        check: DefaultCheckIcon,
        chevronDown: DefaultChevronDownIcon,
        chevronRight: DefaultChevronRightIcon,
        chevronUp: DefaultChevronUpIcon,
        clipboard: DefaultClipboardIcon,
        code: DefaultCodeIcon,
        cpu: DefaultCpuIcon,
        downloadCloud: DefaultDownloadCloudIcon,
        file: DefaultFileIcon,
        fileCode: DefaultFileCodeIcon,
        filePlus: DefaultFilePlusIcon,
        fileText: DefaultFileTextIcon,
        folder: DefaultFolderIcon,
        folderOpen: DefaultFolderOpenIcon,
        globe: DefaultGlobeIcon,
        gpu: DefaultGpuIcon,
        hammer: DefaultHammerIcon,
        identity: DefaultIdentityIcon,
        info: DefaultInfoIcon,
        lightbulb: DefaultLightbulbIcon,
        messagePlus: DefaultMessagePlusIcon,
        messageSquare: DefaultMessageSquareIcon,
        model: DefaultModelIcon,
        moon: DefaultMoonIcon,
        palette: DefaultPaletteIcon,
        paperclip: DefaultPaperclipIcon,
        play: DefaultPlayIcon,
        plus: DefaultPlusIcon,
        ram: DefaultRamIcon,
        search: DefaultSearchIcon,
        send: DefaultSendIcon,
        server: DefaultServerIcon,
        settings: DefaultSettingsIcon,
        sliders: DefaultSlidersIcon,
        sparkles: DefaultSparklesIcon,
        spinner: DefaultSpinnerIcon,
        stop: DefaultStopIcon,
        sun: DefaultSunIcon,
        terminal: DefaultTerminalIcon,
        trash: DefaultTrashIcon,
        x: DefaultXIcon,
        xCircle: DefaultXCircleIcon,
    },
    lucide: {
        bookmark: LucideBookmark,
        brainCircuit: LucideBrainCircuit,
        check: LucideCheck,
        chevronDown: LucideChevronDown,
        chevronRight: LucideChevronRight,
        chevronUp: LucideChevronUp,
        clipboard: LucideClipboard,
        code: LucideCode,
        cpu: LucideCpu,
        downloadCloud: LucideDownloadCloud,
        file: LucideFile,
        fileCode: LucideFileCode,
        filePlus: LucideFilePlus,
        fileText: LucideFileText,
        folder: LucideFolder,
        folderOpen: LucideFolderOpen,
        globe: LucideGlobe,
        gpu: LucideGpu,
        hammer: LucideHammer,
        identity: LucideIdentity,
        info: LucideInfo,
        lightbulb: LucideLightbulb,
        messagePlus: LucideMessagePlus,
        messageSquare: LucideMessageSquare,
        model: LucideModel,
        moon: LucideMoon,
        palette: LucidePalette,
        paperclip: LucidePaperclip,
        play: LucidePlay,
        plus: LucidePlus,
        ram: LucideRam,
        search: LucideSearch,
        send: LucideSend,
        server: LucideServer,
        settings: LucideSettings,
        sliders: LucideSliders,
        sparkles: LucideSparkles,
        spinner: (props: any) => <AnimatedSpinner IconComponent={LucideLoaderCircle} {...props} />,
        stop: LucideStop,
        sun: LucideSun,
        terminal: LucideTerminal,
        trash: LucideTrash,
        x: LucideX,
        xCircle: LucideXCircle,
    },
    heroicons: {
        bookmark: HeroBookmark,
        brainCircuit: HeroBrainCircuit,
        check: HeroCheck,
        chevronDown: HeroChevronDown,
        chevronRight: HeroChevronRight,
        chevronUp: HeroChevronUp,
        clipboard: HeroClipboard,
        code: HeroCode,
        cpu: HeroCpu,
        downloadCloud: HeroDownloadCloud,
        file: HeroFile,
        fileCode: HeroFileCode,
        filePlus: HeroFilePlus,
        fileText: HeroFileText,
        folder: HeroFolder,
        folderOpen: HeroFolderOpen,
        globe: HeroGlobe,
        gpu: HeroGpu,
        hammer: HeroHammer,
        identity: HeroIdentity,
        info: HeroInfo,
        lightbulb: HeroLightbulb,
        messagePlus: HeroMessagePlus,
        messageSquare: HeroMessageSquare,
        model: HeroModel,
        moon: HeroMoon,
        palette: HeroPalette,
        paperclip: HeroPaperclip,
        play: HeroPlay,
        plus: HeroPlus,
        ram: HeroRam,
        search: HeroSearch,
        send: HeroSend,
        server: HeroServer,
        settings: HeroSettings,
        sliders: HeroSliders,
        sparkles: HeroSparkles,
        spinner: (props: any) => <AnimatedSpinner IconComponent={HeroArrowPath} {...props} />,
        stop: HeroStop,
        sun: HeroSun,
        terminal: HeroTerminal,
        trash: HeroTrash,
        x: HeroX,
        xCircle: HeroXCircle,
    },
    feather: {
        bookmark: Feather.Bookmark,
        brainCircuit: Feather.GitBranch, // Substitute
        check: Feather.Check,
        chevronDown: Feather.ChevronDown,
        chevronRight: Feather.ChevronRight,
        chevronUp: Feather.ChevronUp,
        clipboard: Feather.Clipboard,
        code: Feather.Code,
        cpu: Feather.Cpu,
        downloadCloud: Feather.DownloadCloud,
        file: Feather.File,
        fileCode: Feather.Code, // Using Code as a substitute for non-existent FileCode
        filePlus: Feather.FilePlus,
        fileText: Feather.FileText,
        folder: Feather.Folder,
        folderOpen: Feather.FolderOpen,
        globe: Feather.Globe,
        gpu: Feather.HardDrive,
        hammer: Feather.Tool, // Substitute
        identity: Feather.User,
        info: Feather.Info,
        lightbulb: Feather.Zap, // Substitute
        messagePlus: Feather.MessageSquare, // No plus variant
        messageSquare: Feather.MessageSquare,
        model: Feather.Box,
        moon: Feather.Moon,
        palette: Feather.Palette,
        paperclip: Feather.Paperclip,
        play: Feather.Play,
        plus: Feather.Plus,
        ram: Feather.Server,
        search: Feather.Search,
        send: Feather.Send,
        server: Feather.Server,
        settings: Feather.Settings,
        sliders: Feather.Sliders,
        sparkles: Feather.Star,
        spinner: (props: any) => <AnimatedSpinner IconComponent={Feather.Loader} {...props} />,
        stop: Feather.Square,
        sun: Feather.Sun,
        terminal: Feather.Terminal,
        trash: Feather.Trash2,
        x: Feather.X,
        xCircle: Feather.XCircle,
    },
    fontawesome: {
        bookmark: FaBookmark,
        brainCircuit: FaBrain,
        check: FaCheck,
        chevronDown: FaChevronDown,
        chevronRight: FaChevronRight,
        chevronUp: FaChevronUp,
        clipboard: FaClipboard,
        code: FaCode,
        cpu: FaMicrochip,
        downloadCloud: FaDownloadCloud,
        file: FaFile,
        fileCode: FaFileCode,
        filePlus: FaFileMedical,
        fileText: FaFileAlt,
        folder: FaFolder,
        folderOpen: FaFolderOpen,
        globe: FaGlobe,
        gpu: FaServerIcon,
        hammer: FaHammer,
        identity: FaUserCog,
        info: FaInfoCircle,
        lightbulb: FaLightbulb,
        messagePlus: FaCommentMedical,
        messageSquare: FaComment,
        model: FaCube,
        moon: FaMoon,
        palette: FaPalette,
        paperclip: FaPaperclip,
        play: FaPlay,
        plus: FaPlus,
        ram: FaMemory,
        search: FaSearch,
        send: FaPaperPlane,
        server: FaServerIcon,
        settings: FaCog,
        sliders: FaSlidersH,
        sparkles: FaMagic,
        spinner: (props: any) => <AnimatedSpinner IconComponent={FaSpinner} {...props} />,
        stop: FaStop,
        sun: FaSun,
        terminal: FaTerminal,
        trash: FaTrash,
        x: FaTimes,
        xCircle: FaTimesCircle,
    },
    material: {
        bookmark: MdBookmark,
        brainCircuit: MdPsychology,
        check: MdCheck,
        chevronDown: MdExpandMore,
        chevronRight: MdChevronRight,
        chevronUp: MdChevronUp,
        clipboard: MdContentPaste,
        code: MdCode,
        cpu: MdDeveloperBoard,
        downloadCloud: MdDownloadCloud,
        file: MdInsertDriveFile,
        fileCode: MdSource,
        filePlus: MdNoteAdd,
        fileText: MdDescription,
        folder: MdFolder,
        folderOpen: MdFolderOpen,
        globe: MdPublic,
        gpu: MdMemory,
        hammer: MdBuild,
        identity: MdAccountBox,
        info: MdInfo,
        lightbulb: MdLightbulb,
        messagePlus: MdAddComment,
        messageSquare: MdChat,
        model: MdViewInAr,
        moon: MdBrightness2,
        palette: MdPalette,
        paperclip: MdAttachFile,
        play: MdPlayArrow,
        plus: MdAdd,
        ram: MdMemory,
        search: MdSearch,
        send: MdSend,
        server: MdDns,
        settings: MdSettings,
        sliders: MdTune,
        sparkles: MdAutoAwesome,
        spinner: (props: any) => <AnimatedSpinner IconComponent={MdCached} {...props} />,
        stop: MdStop,
        sun: MdWbSunny,
        terminal: MdTerminal,
        trash: MdDelete,
        x: MdClose,
        xCircle: MdCancel,
    },
};

type IconName = keyof (typeof iconMap)['default'];

interface IconProps extends React.SVGProps<SVGSVGElement> {
    name: IconName;
    className?: string;
}

const Icon: React.FC<IconProps> = ({ name, ...rest }) => {
    const { iconSet } = useIconSet();
    const IconComponent = iconMap[iconSet]?.[name] || iconMap.default[name];
    
    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in set "${iconSet}" or default set.`);
        return null; 
    }
    
    const props = { ...rest, strokeWidth: (iconSet === 'heroicons' ? 2 : rest.strokeWidth) };

    return <IconComponent {...props} />;
};

export default Icon;
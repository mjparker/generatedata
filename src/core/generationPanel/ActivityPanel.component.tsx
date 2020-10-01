import React, { useEffect } from 'react';
import { PieChart, Pie, Cell, AreaChart, CartesianGrid, XAxis, YAxis, Area } from 'recharts';
import CountUp from 'react-countup';
import IconButton from '@material-ui/core/IconButton';
import Slider from '@material-ui/core/Slider';
import Button from '@material-ui/core/Button';
import Pause from '@material-ui/icons/Pause';
import PlayArrow from '@material-ui/icons/PlayArrow';
import ExpandMore from "@material-ui/icons/ExpandMore";
import { Dialog, DialogContent, DialogTitle, DialogActions } from '~components/dialogs';
import usePrevious from '../../hooks/usePrevious';
import useDidUpdate from '../../hooks/useDidUpdate';
import styles from './ActivityPanel.scss';
import { DataPacket } from '../store/packets/packets.reducer';
import * as coreUtils from '~utils/coreUtils';
import C from '../constants';
import { getStrings } from '~utils/langUtils';
import { Tooltip } from '~components/tooltips';
import { getPercentageLabel } from './generation.helpers';

export type ActivityPanelProps = {
	visible: boolean;
	i18n: any;
	packet: DataPacket | null;
	onClose: () => void;
	onPause: () => void;
	onContinue: () => void;
	onAbort: () => void;
	onDownload: () => void;
	workerResources: any;
	logDataBatch: (numGeneratedRows: number, data: any) => void;
	batchLoadTimes: object[];
	dataSize: string;
	estimatedSize: string;
};

const valueLabelFormat = (value: number): string => `${value}%`;

const ActivityPanel = ({
	visible, onClose, packet, onContinue, onPause, workerResources, logDataBatch, batchLoadTimes, onAbort,
	onDownload, dataSize, estimatedSize, i18n
}: ActivityPanelProps): any => {
	if (packet === null) {
		return null;
	}

	const { isPaused, config, dataTypeWorkerId, exportTypeWorkerId, numGeneratedRows, speed } = packet;
	const { numRowsToGenerate, columns, template, exportType, exportTypeSettings, stripWhitespace } = config;

	const prevGeneratedRows = usePrevious(numGeneratedRows);
	const dataTypeWorker = coreUtils.getDataTypeWorker(dataTypeWorkerId);
	const exportTypeWorker = coreUtils.getExportTypeWorker(exportTypeWorkerId);

	useEffect(() => {
		if (numGeneratedRows !== 0) {
			return;
		}

		dataTypeWorker.postMessage({
			action: 'generate',
			numResults: numRowsToGenerate,
			batchSize: C.GENERATION_BATCH_SIZE,
			columns,
			i18n: getStrings(),
			template,
			workerResources
		});

		dataTypeWorker.onmessage = ({ data }: any): void => {
			const { completedBatchNum, numGeneratedRows, generatedData } = data;
			const isLastBatch = numGeneratedRows >= numRowsToGenerate;

			exportTypeWorker.postMessage({
				rows: generatedData,
				columns,
				exportType,
				exportTypeSettings,
				stripWhitespace,
				isFirstBatch: completedBatchNum === 1,
				isLastBatch,
				workerResources
			});

			exportTypeWorker.onmessage = (resp: any): void => {
				logDataBatch(numGeneratedRows, resp.data);
			};
		};
	}, [numGeneratedRows]);

	useDidUpdate(() => {
		dataTypeWorker.postMessage({
			action: isPaused ? C.ACTIVITY_PANEL_ACTIONS.PAUSE : C.ACTIVITY_PANEL_ACTIONS.CONTINUE
		});
	}, [isPaused]);

	useDidUpdate(() => {
		dataTypeWorker.postMessage({
			action: isPaused ? C.ACTIVITY_PANEL_ACTIONS.PAUSE : C.ACTIVITY_PANEL_ACTIONS.CONTINUE
		});
	}, [isPaused]);


	const animation = true;
	const percentage = (numGeneratedRows / numRowsToGenerate) * 100;
	const isComplete = percentage === 100;

	const pieChartData = [
		{ name: i18n.complete, value: percentage, color: '#275eb5' },
		{ name: i18n.incomplete, value: 100-percentage, color: '#efefef' }
	];

	const pauseContinueIcon = isPaused ?
		<PlayArrow fontSize="large" onClick={onContinue} /> :
		<Pause fontSize="large" onClick={onPause} />;

	const marks = [
		{
			value: 0,
			label: i18n.seriouslySlow
		},
		{
			value: 100,
			label: i18n.cpuMeltinglyFast
		}
	];

	const getActionButtons = (): JSX.Element => {
		if (isComplete) {
			return (
				<>
					<Button onClick={onAbort} color="default" variant="outlined" style={{ marginRight: 10 }}>
						{i18n.clearAndClose}
					</Button>
					<Button onClick={onDownload} color="primary" variant="outlined" style={{ marginRight: 10 }}>
						{i18n.download}
					</Button>
				</>
			);
		}

		return (
			<Button onClick={onAbort} color="secondary" variant="outlined" style={{ marginRight: 10 }}>
				{i18n.cancelGeneration}
			</Button>
		);
	};

	const getGenerationControls = (): React.ReactNode => {
		// TODO apply class to fade out instead
		if (isComplete) {
			return null;
		}

		// TODO tooltip needs higher z-index
		const tooltip = isPaused ? i18n.play : i18n.pause;

		return (
			<div style={{ flex: 1, display: 'flex', marginRight: 80 }}>
				<Tooltip title={tooltip} placement="top" arrow style={{ marginRight: 50 }}>
					<IconButton size="medium" aria-label={tooltip}>
						{pauseContinueIcon}
					</IconButton>
				</Tooltip>
				<Slider
					defaultValue={speed}
					aria-labelledby="discrete-slider-always"
					step={1}
					min={1}
					max={100}
					valueLabelDisplay="auto"
					valueLabelFormat={valueLabelFormat}
					marks={marks}
				/>
			</div>
		);
	};

	return (
		<Dialog onClose={onClose} open={visible}>
			<div style={{ maxWidth: 800 }}>
				<DialogTitle onClose={onClose} customCloseIcon={ExpandMore}>
					Generated: <CountUp start={prevGeneratedRows} end={numGeneratedRows} separator="," className={styles.counter} /> rows
				</DialogTitle>
				<DialogContent dividers style={{ padding: 0 }}>
					<div className={styles.overlayWrapper}>
						<div style={{ display: 'flex' }}>

							<div className={styles.panel1}>
								<h3>{getPercentageLabel(percentage, numRowsToGenerate)}%</h3>

								<PieChart width={180} height={180}>
									<Pie
										dataKey="value"
										isAnimationActive={animation}
										data={pieChartData}
										cx={90}
										cy={90}
										innerRadius={50}
										outerRadius={85}
										startAngle={90}
										endAngle={-270}>
										{pieChartData.map((entry, index) => <Cell key={index} fill={pieChartData[index].color} />)}
									</Pie>
								</PieChart>

								<div>
									Estimated time:
								</div>
								<div>
									Remaining time:
								</div>
								<div>
									Estimated Size: <b>{estimatedSize}</b>
								</div>
								<div>
									Size: <b>{dataSize}</b>
								</div>
							</div>

							<div className={styles.panel2}>
								<AreaChart
									width={500}
									height={400}
									data={batchLoadTimes}
									margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="name" />
									<YAxis />
									<Area type="monotone" dataKey="duration" stroke="#8884d8" fill="#8884d8" />
								</AreaChart>
							</div>
						</div>
					</div>
				</DialogContent>
				<DialogActions>
					{getGenerationControls()}
					{getActionButtons()}
				</DialogActions>
			</div>
		</Dialog>
	);
};

export default ActivityPanel;

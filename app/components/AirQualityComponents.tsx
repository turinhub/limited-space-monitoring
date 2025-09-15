'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Thermometer, Droplets, Wind, Flame, Skull, CloudSnow } from 'lucide-react';

// 空气质量统计组件
export function AirQualityStats() {
  const [stats, setStats] = useState({
    totalSensors: 0,  // 改为0，等待API返回实际数量
    onlineSensors: 0,
    alertCount: 0,
    safetyLevel: '未知',
    alerts: [] as string[]
  });

  // 获取监测点数据
  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/clickhouse/monitoring-points');
      const result = await response.json();
      
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        // 获取所有设备ID
        const deviceIds = [...new Set(result.data.map((item: any) => item.device_id))];
        const totalDevices = deviceIds.length;

        // 获取每个设备的最新数据
        const apiDataMap: { [key: string]: any } = {};
        result.data.forEach((item: any) => {
          const deviceKey = `D${item.device_id}`;
          if (!apiDataMap[deviceKey] || 
              new Date(item.create_time) > new Date(apiDataMap[deviceKey].create_time)) {
            apiDataMap[deviceKey] = item;
          }
        });

        // 在数据处理部分添加日志
        Object.entries(apiDataMap).forEach(([deviceKey, data]: [string, any]) => {
          console.log(`设备${data.device_id}气体数据:`, {
            甲烷: data.methane,
            硫化氢: data.h2s,
            氧气: data.oxygen,
            二氧化碳: data.co2,
            一氧化碳: data.co,
          });
        });

        // 检查预警情况
        const alerts: string[] = [];
        let alertPointCount = 0;  // 添加预警点位计数

        Object.values(apiDataMap).forEach((data: any) => {
          let hasAlert = false;  // 用于标记该监测点是否有预警
          let status: 'normal' | 'warning' | 'danger' | 'offline' = 'normal';

          // 危险级别判断
          if (
            data.oxygen <= 19.5 ||      // 氧气低于 19.5%
            data.oxygen >= 23.5 ||      // 氧气高于 23.5%
            data.methane >= 1.25 ||     // 甲烷超过 1.25% LEL
            data.h2s >= 10 ||           // 硫化氢超过 10ppm
            data.co >= 100 ||           // 一氧化碳超过 100ppm
            data.co2 >= 5000 || data.oxygen <= 19.5     // 二氧化碳超过 5000ppm
          ) {
            status = 'danger';
            hasAlert = true;
            // 添加预警信息
            if (data.oxygen === 0) alerts.push(`设备${data.device_id}: 氧气浓度为0，极度危险！`);
            else if (data.oxygen <= 19.5) alerts.push(`设备${data.device_id}: 氧气浓度严重不足`);
            else if (data.oxygen >= 23.5) alerts.push(`设备${data.device_id}: 氧气浓度严重超标`);
            
            if (data.methane >= 1.25) alerts.push(`设备${data.device_id}: 甲烷浓度严重超标`);
            if (data.h2s >= 10) alerts.push(`设备${data.device_id}: 硫化氢浓度严重超标`);
            if (data.co >= 100) alerts.push(`设备${data.device_id}: 一氧化碳浓度严重超标`);
            if (data.co2 >= 5000) alerts.push(`设备${data.device_id}: 二氧化碳浓度严重超标`);
          }
          // 警告级别判断
          else if (
            data.methane >= 0.5 ||      // 甲烷超过 0.5% LEL
            data.h2s >= 5 ||            // 硫化氢超过 5ppm
            data.oxygen <= 20.0 ||      // 氧气低于 20.0%
            data.oxygen >= 23.0 ||      // 氧气高于 23.0%
            data.co >= 35 ||            // 一氧化碳超过 35ppm
            data.co2 >= 1000            // 二氧化碳超过 1000ppm
          ) {
            status = 'warning';
            hasAlert = true;
            // 添加预警信息
            if (data.methane >= 0.5) alerts.push(`设备${data.device_id}: 甲烷浓度超标`);
            if (data.h2s >= 5) alerts.push(`设备${data.device_id}: 硫化氢浓度超标`);
            if (data.oxygen <= 20.0) alerts.push(`设备${data.device_id}: 氧气浓度过低`);
            if (data.oxygen >= 23.0) alerts.push(`设备${data.device_id}: 氧气浓度过高`);
            if (data.co >= 35) alerts.push(`设备${data.device_id}: 一氧化碳浓度超标`);
            if (data.co2 >= 1000) alerts.push(`设备${data.device_id}: 二氧化碳浓度超标`);
          }

          // 如果该监测点有预警，增加预警点位计数
          if (hasAlert) {
            alertPointCount++;
          }
        });

        // 更新状态
        setStats({
          totalSensors: totalDevices,
          onlineSensors: totalDevices,
          alertCount: alertPointCount,  // 使用预警点位数量
          safetyLevel: alerts.some(alert => alert.includes('严重')) ? '危险' : alerts.length > 0 ? '异常' : '良好',
          alerts: alerts
        });
      } else {
        // 如果没有数据，重置状态
        setStats({
          totalSensors: 0,
          onlineSensors: 0,
          alertCount: 0,
          safetyLevel: '未知',
          alerts: []
        });
      }
    } catch (error) {
      console.error('获取监测点数据失败:', error);
      // 发生错误时，重置状态
      setStats({
        totalSensors: 0,
        onlineSensors: 0,
        alertCount: 0,
        safetyLevel: '未知',
        alerts: []
      });
    }
  };

  useEffect(() => {
    // 立即执行一次
    fetchMonitoringData();
    
    // 每10秒更新一次
    const interval = setInterval(fetchMonitoringData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="air-quality-stats-container">
      <h3 className="chart-title"><Wind size={20} style={{marginRight: '8px', verticalAlign: 'middle'}} />空气质量</h3>
      <div className="stats-content">
        <div className="stat-item main-stat">
          <div className="stat-icon">
            <Wind size={32} color="#4ecdc4" />
          </div>
          <div className="stat-info">
            <div className="stat-label">当前安全等级</div>
            <div className="stat-label-en">SAFETY LEVEL</div>
            <div className="stat-value" style={{ 
              color: stats.safetyLevel === '危险' ? '#ef4444' : '#10b981',  // 危险时显示红色，否则保持绿色
            }}>
              {stats.safetyLevel}
            </div>
          </div>
        </div>
        
        <div className="stat-row">
          <div className="stat-item small-stat">
            <div className="stat-icon-small">
              <CheckCircle size={24} color="#4ecdc4" />
            </div>
            <div className="stat-info-small">
              <div className="stat-label-small">在线传感器</div>
              <div className="stat-value-small">{stats.onlineSensors}/{stats.totalSensors}</div>
            </div>
          </div>
          
          <div className="stat-item small-stat">
            <div className="stat-icon-small">
              <AlertTriangle size={24} color="#feca57" />
            </div>
            <div className="stat-info-small">
              <div className="stat-label-small">预警数量</div>
              <div className="stat-value-small">{stats.alertCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// 环境监测组件
export function EnvironmentMonitor() {
  const [envData, setEnvData] = useState({
    temperature: 23.5,
    humidity: 65.2,
    pressure: 1013.2,
    airFlow: 2.3
  });
  const [monitoringPoints, setMonitoringPoints] = useState<any[]>([]);

  // 获取监测点数据
  const fetchMonitoringData = async () => {
    try {
      const response = await fetch('/api/clickhouse/monitoring-points');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          setMonitoringPoints(result.data);
          // 使用第一个监测点的温度和湿度数据
          const firstPoint = result.data[0];
          setEnvData(prev => ({
            ...prev,
            temperature: firstPoint.temperature || prev.temperature,
            humidity: firstPoint.humidity || prev.humidity
          }));
        }
      }
    } catch (error) {
      console.error('获取监测数据失败:', error);
    }
  };

  useEffect(() => {
    // 初始加载数据
    fetchMonitoringData();
    
    // 定期更新数据
    const interval = setInterval(() => {
      fetchMonitoringData();
      // 只更新气压和风速的模拟数据
      setEnvData(prev => ({
        ...prev,
        pressure: 1013.2 + (Math.random() - 0.5) * 5,
        airFlow: 2.3 + (Math.random() - 0.5) * 0.5
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="air-quality-stats-container">
      <h3 className="chart-title"><Thermometer size={20} style={{marginRight: '8px', verticalAlign: 'middle'}} />环境监测</h3>
      <div className="env-monitor-grid">
        <div className="env-item">
          <div className="env-icon">
            <Thermometer size={20} color="#ff6b6b" />
          </div>
          <div className="env-info">
            <div className="env-label">温度</div>
            <div className="env-value">{envData.temperature.toFixed(1)}°C</div>
          </div>
        </div>
        
        <div className="env-item">
          <div className="env-icon">
            <Droplets size={20} color="#4ecdc4" />
          </div>
          <div className="env-info">
            <div className="env-label">湿度</div>
            <div className="env-value">{envData.humidity.toFixed(1)}%</div>
          </div>
        </div>
        
        <div className="env-item">
          <div className="env-icon">
            <CloudSnow size={20} color="#96ceb4" />
          </div>
          <div className="env-info">
            <div className="env-label">气压</div>
            <div className="env-value">{envData.pressure.toFixed(1)} hPa</div>
          </div>
        </div>
        
        <div className="env-item">
          <div className="env-icon">
            <Wind size={20} color="#45b7d1" />
          </div>
          <div className="env-info">
            <div className="env-label">风速</div>
            <div className="env-value">{envData.airFlow.toFixed(1)} m/s</div>
          </div>
        </div>
      </div>
    </div>
  );
}
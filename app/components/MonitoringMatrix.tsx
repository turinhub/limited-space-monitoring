'use client';

import { useState, useEffect } from 'react';
import { MapPin, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface MonitoringPoint {
  id: string;
  name: string;
  location: string;
  status: 'normal' | 'warning' | 'danger' | 'offline';
  temperature: number;
  humidity: number;
  oxygen: number;
  h2s: number;
  co2: number;
  co: number;
  methane: number;
  lastUpdate: string;
}

export function MonitoringMatrix() {
  const [monitoringPoints, setMonitoringPoints] = useState<MonitoringPoint[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#4ecdc4';
      case 'warning': return '#feca57';
      case 'danger': return '#ff6b6b';
      case 'offline': return '#666';
      default: return '#4ecdc4';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'danger': return <AlertTriangle size={16} />;
      case 'offline': return <XCircle size={16} />;
      default: return <CheckCircle size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'warning': return '警告';
      case 'danger': return '危险';
      case 'offline': return '离线';
      default: return '正常';
    }
  };

  // ClickHouse 数据请求函数
  const fetchClickHouseData = async () => {
    try {
      console.log('🔄 开始请求 ClickHouse 数据...');
      const response = await fetch('/api/clickhouse/monitoring-points');
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('📊 ClickHouse 响应数据概览:', {
        success: result.success,
        timestamp: result.timestamp,
        message: result.message,
        source: result.source,
        dataCount: result.data?.length || 0,
        rows: result.rows,
        hasMetadata: !!result.meta
      });
      
      if (result.success && result.data) {
        setConnectionError(null);  // 清除错误状态
        console.log('✅ ClickHouse 数据请求成功');
        console.log('📋 数据源:', result.source);
        console.log('📏 数据行数:', result.rows);
        
        // 打印元数据信息
        if (result.meta) {
          console.log('📋 数据字段元信息:');
          console.table(result.meta);
        }
        
        // 打印完整的数据
        console.log('📊 完整数据列表:');
        console.log(result.data);
        
        // 分析并打印数据统计
        const deviceIds = [...new Set(result.data.map((item: any) => item.device_id))];
        
        console.log('📈 数据统计分析:');
        console.log(`- 设备总数: ${deviceIds.length}`);
        console.log(`- 设备ID列表: ${deviceIds.join(', ')}`);
        console.log(`- 数据记录总数: ${result.data.length}`);
        console.log(`- 数据: ${deviceIds}`)
        
        console.log('🔄 各设备最新数据:');
        
        // 根据API返回的数据更新UI
        const apiDataMap: { [key: string]: any } = {};
        result.data.forEach((item: any) => {
          const deviceKey = `D${item.device_id}`;
          if (!apiDataMap[deviceKey] || 
              new Date(item.create_time) > new Date(apiDataMap[deviceKey].create_time)) {
            apiDataMap[deviceKey] = item;
          }
        });

        // 打印每个设备的最新数据
        Object.entries(apiDataMap).forEach(([deviceKey, data]: [string, any]) => {
          console.log(`设备${data.device_id}:`, {
            设备ID: data.device_id,
            温度: data.temperature,
            湿度: data.humidity,
            氧气: data.oxygen,
            甲烷: data.methane,
            硫化氢: data.h2s,
            二氧化碳: data.co2,
            一氧化碳: data.co,
            记录时间: data.record_time,
            创建时间: data.create_time
          });
        });

        // 更新监测点数据以反映真实的API数据
        const updatedPoints = Object.values(apiDataMap).map((data: any, index: number) => {
          const zones = ['A', 'B', 'C'];
          const zoneIndex = Math.floor(index / 2);
          const pointIndex = (index % 2) + 1;
          const pointId = `${zones[zoneIndex]}${pointIndex.toString().padStart(2, '0')}`;
          
          // 修改状态判断逻辑
          let status: 'normal' | 'warning' | 'danger' | 'offline' = 'normal';

          // 危险级别判断
          if (
            data.oxygen === 0 ||        // 氧气为0时直接判定危险
            data.oxygen <= 19.5 ||      // 氧气低于 19.5%
            data.oxygen >= 23.5 ||      // 氧气高于 23.5%
            data.methane >= 1.25 ||     // 甲烷超过 1.25% LEL
            data.h2s >= 10 ||           // 硫化氢超过 10ppm
            data.co >= 100 ||           // 一氧化碳超过 100ppm
            data.co2 >= 5000            // 二氧化碳超过 5000ppm
          ) {
            status = 'danger';
          }

          return {
            id: pointId,
            name: `${zones[zoneIndex]}区-${pointIndex}号点`,
            location: `设备${data.device_id}`,
            status,
            temperature: data.temperature || 0,
            humidity: data.humidity || 0,
            oxygen: data.oxygen || 0,
            h2s: data.h2s || 0,
            co2: data.co2 || 0,
            co: data.co || 0,
            methane: data.methane || 0,
            lastUpdate: new Date().toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })
          };
        });

        // 直接使用API数据更新状态，无论数据多少
        setMonitoringPoints(updatedPoints);
        console.log(`✅ 已更新监测点矩阵数据，使用真实API数据，共${updatedPoints.length}个监测点`);
        
      } else {
        console.error('❌ ClickHouse 数据请求失败:', result.message || result.error || 'Unknown error');
        setConnectionError('数据库连接失败');
        setMonitoringPoints([]);
        if (result.error) {
          console.error('🔍 错误详情:', result.error);
        }
      }
    } catch (error) {
      console.error('🚨 ClickHouse 请求异常:', error instanceof Error ? error.message : error);
      setConnectionError('数据库连接异常');
      setMonitoringPoints([]);
    }
  };

  useEffect(() => {
    // 生成24小时的历史数据
    const hours: string[] = [];
    const avgMethane: number[] = [];
    const avgH2s: number[] = [];
    const avgOxygen: number[] = [];
    const maxMethane: number[] = [];
    const maxH2s: number[] = [];
    const maxOxygen: number[] = [];
    const coData: number[] = [];
    const maxCo: number[] = [];
    const co2Data: number[] = [];
    const maxCo2: number[] = [];

    // 立即执行一次数据请求
    fetchClickHouseData();
    
    // 设置定时器，每10秒请求一次ClickHouse数据
    const clickhouseInterval = setInterval(fetchClickHouseData, 10000);

    return () => {
      clearInterval(clickhouseInterval);
    };
  }, []);

  return (
    <div className="air-quality-stats-container">
      <h3 className="chart-title"><MapPin size={20} style={{marginRight: '8px', verticalAlign: 'middle'}} />监测矩阵</h3>
      <div className="monitoring-matrix-container" style={{
        height: 'calc(100% - 40px)',
        overflowY: 'auto',
        padding: '0 5px',
        scrollbarWidth: 'thin',
        scrollbarColor: '#4ecdc4 transparent'
      }}>
        <style jsx>{`
          .monitoring-matrix-container::-webkit-scrollbar {
            width: 6px;
          }
          .monitoring-matrix-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }
          .monitoring-matrix-container::-webkit-scrollbar-thumb {
            background: #4ecdc4;
            border-radius: 3px;
            transition: background 0.3s ease;
          }
          .monitoring-matrix-container::-webkit-scrollbar-thumb:hover {
            background: #45b7d1;
          }
          .monitoring-point {
            transition: all 0.3s ease;
            border: 1px solid rgba(78, 205, 196, 0.3);
            position: relative;
            overflow: hidden;
          }
          .monitoring-point:hover {
            border-color: #4ecdc4;
            box-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
          }
          .monitoring-point::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(78, 205, 196, 0.1);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            border-radius: 7px;
          }
          .monitoring-point:hover::before {
            opacity: 1;
          }
        `}</style>
        <div className="monitoring-matrix" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '6px',
          minHeight: '100px'
        }}>
          {connectionError ? (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              color: '#ff6b6b',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '10px', fontSize: '24px' }}>⚠️</div>
              <div>{connectionError}</div>
              <div style={{ 
                fontSize: '12px', 
                marginTop: '5px',
                color: '#94a3b8'
              }}>请检查数据库连接状态</div>
            </div>
          ) : monitoringPoints.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              color: '#666',
              fontSize: '14px'
            }}>
              <div style={{ marginBottom: '10px', fontSize: '24px' }}>📊</div>
              <div>暂无监测点数据</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>等待ClickHouse数据...</div>
            </div>
          ) : (
            monitoringPoints.map((point) => (
            <div key={point.id} className="monitoring-point" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '6px',
              fontSize: '11px',
              minHeight: '100px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start'
            }}>
              <div className="point-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '6px'
              }}>
                <div className="point-info">
                  <div className="point-id" style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#4ecdc4',
                    marginBottom: '2px'
                  }}>{point.id}</div>
                  <div className="point-name" style={{
                    fontSize: '12px',
                    color: '#fff',
                    marginBottom: '1px'
                  }}>{point.name}</div>
                  <div className="point-location" style={{
                    fontSize: '9px',
                    color: '#999',
                    opacity: 0.8
                  }}>{point.location}</div>
                </div>
                <div className="point-status" style={{ 
                  color: getStatusColor(point.status),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: '9px'
                }}>
                  {getStatusIcon(point.status)}
                  <span>{getStatusText(point.status)}</span>
                </div>
              </div>
              
              <div className="point-data" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0'  // 移除外层间距
              }}>
                {/* 所有数据项单行展示 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0'  // 移除内层间距
                }}>
                  {/* 温度 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'  // 移除内边距
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>温度</span>
                    <span className="data-value" style={{ 
                      color: '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'  // 添加少许右边距
                    }}>
                      {point.temperature.toFixed(1)}°C
                    </span>
                  </div>

                  {/* 湿度 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>湿度</span>
                    <span className="data-value" style={{ 
                      color: '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.humidity.toFixed(1)}%
                    </span>
                  </div>

                  {/* 氧气 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>氧气</span>
                    <span className="data-value" style={{ 
                      color: point.oxygen < 20.5 ? '#ff6b6b' : '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.oxygen.toFixed(1)}%
                    </span>
                  </div>

                  {/* 硫化氢 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>硫化氢</span>
                    <span className="data-value" style={{ 
                      color: point.h2s > 0.05 ? '#ff9ff3' : '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.h2s.toFixed(2)} ppm
                    </span>
                  </div>

                  {/* 二氧化碳 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>二氧化碳</span>
                    <span className="data-value" style={{ 
                      color: point.co2 > 1000 ? '#feca57' : '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.co2.toFixed(1)} ppm
                    </span>
                  </div>

                  {/* 一氧化碳 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>一氧化碳</span>
                    <span className="data-value" style={{ 
                      color: point.co > 50 ? '#ff6b6b' : '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.co.toFixed(1)} ppm
                    </span>
                  </div>

                  {/* 甲烷 */}
                  <div className="data-item" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderRadius: '4px',
                    height: '18px',
                    marginBottom: '0',
                    padding: '0'
                  }}>
                    <span className="data-label" style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '18px',
                      paddingLeft: '0'
                    }}>甲烷</span>
                    <span className="data-value" style={{ 
                      color: point.methane > 2.5 ? '#feca57' : '#4ecdc4',
                      fontSize: '12px',
                      fontWeight: '600',
                      lineHeight: '18px',
                      paddingRight: '4px'
                    }}>
                      {point.methane.toFixed(1)} ppm
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="point-footer" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '3px',
                paddingTop: '2px',
                borderTop: '1px solid rgba(78, 205, 196, 0.2)'
              }}>
                <span className="update-time" style={{
                  fontSize: '8px',
                  color: '#999'
                }}>更新: {point.lastUpdate}</span>
                <div className="signal-strength" style={{
                  display: 'flex',
                  gap: '1px',
                  alignItems: 'flex-end'
                }}>
                  <div className="signal-bar" style={{
                    width: '2px',
                    height: '4px',
                    backgroundColor: point.status === 'offline' ? '#666' : '#4ecdc4',
                    borderRadius: '1px'
                  }}></div>
                  <div className="signal-bar" style={{
                    width: '2px',
                    height: '6px',
                    backgroundColor: point.status === 'offline' ? '#666' : '#4ecdc4',
                    borderRadius: '1px'
                  }}></div>
                  <div className="signal-bar" style={{
                    width: '2px',
                    height: '8px',
                    backgroundColor: point.status === 'offline' ? '#666' : '#4ecdc4',
                    borderRadius: '1px'
                  }}></div>
                  <div className="signal-bar" style={{
                    width: '2px',
                    height: '10px',
                    backgroundColor: point.status === 'offline' ? '#666' : '#4ecdc4',
                    borderRadius: '1px'
                  }}></div>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}